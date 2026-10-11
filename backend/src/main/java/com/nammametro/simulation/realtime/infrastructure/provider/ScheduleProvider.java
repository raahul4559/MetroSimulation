package com.nammametro.simulation.realtime.infrastructure.provider;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.application.FeedMapping;
import com.nammametro.simulation.realtime.application.MetroRealtimeProvider;
import com.nammametro.simulation.realtime.application.RouteTimings;
import com.nammametro.simulation.realtime.application.ServiceCalendar;
import com.nammametro.simulation.realtime.application.TrackGeometry;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Where the configured timetable says every train should be at {@code now} — the
 * {@link DataSource#SCHEDULE} source. Pure arithmetic over {@link ServiceCalendar} departures and
 * {@link RouteTimings}; it evaluates any instant directly (no fast-forwarding a simulation) and is
 * cheap enough to run on every publish, so it is a local, unpolled provider.
 *
 * <p>Its output is an estimate and is labelled as one everywhere: trip updates carry timetabled
 * times with a null delay (a timetable can't know about delays), and nothing here is ever shown as
 * live. It speaks the network's own codes ({@link FeedMapping#internal()}), and goes through the
 * same {@code FeedNormalizer} as an external feed, so timetable trains are placed by exactly the
 * same rules as observed ones.
 *
 * <p>A run is shown standing at its origin for the origin's dwell before its departure time, and at
 * its terminus for the terminus's dwell after arrival.
 */
public class ScheduleProvider implements MetroRealtimeProvider {

    /** The last few seconds before a timetabled arrival are reported as {@code INCOMING_AT}. */
    static final int INCOMING_WINDOW_SECONDS = 6;

    private final ServiceCalendar calendar;
    private final Map<String, Map<TrainDirection, RouteTimings>> timingsByLine;

    public ScheduleProvider(MetroNetwork network, ServiceCalendar calendar) {
        this.calendar = calendar;
        this.timingsByLine = new HashMap<>();
        for (Line line : network.allLines()) {
            Map<TrainDirection, RouteTimings> byDirection = new EnumMap<>(TrainDirection.class);
            for (TrainDirection direction : TrainDirection.values()) {
                byDirection.put(direction, RouteTimings.of(network, line, direction));
            }
            timingsByLine.put(line.code(), byDirection);
        }
    }

    @Override
    public DataSource source() {
        return DataSource.SCHEDULE;
    }

    @Override
    public String name() {
        return "Timetable";
    }

    @Override
    public boolean isConfigured() {
        return calendar.timetable().isConfigured();
    }

    @Override
    public boolean isPolled() {
        return false;
    }

    @Override
    public FeedMapping mapping() {
        return FeedMapping.internal();
    }

    @Override
    public List<VehiclePosition> getVehiclePositions(Instant now) {
        return fetchSnapshot(now).vehiclePositions();
    }

    @Override
    public List<TripUpdate> getTripUpdates(Instant now) {
        return fetchSnapshot(now).tripUpdates();
    }

    /** A timetable has no alerts. */
    @Override
    public List<ServiceAlert> getServiceAlerts(Instant now) {
        return List.of();
    }

    @Override
    public ProviderSnapshot fetchSnapshot(Instant now) {
        LocalDate serviceDay = calendar.serviceDay(now);
        long secondsIntoDay = MetroTime.secondsIntoServiceDay(now, serviceDay);

        List<VehiclePosition> positions = new ArrayList<>();
        List<TripUpdate> updates = new ArrayList<>();
        for (String lineCode : calendar.timetable().lines().keySet()) {
            Map<TrainDirection, RouteTimings> byDirection = timingsByLine.get(lineCode);
            if (byDirection == null) {
                continue; // a timetabled line this network doesn't model
            }
            // Exceptions applied: a closed day has no departures, special hours replace the regular ones.
            List<Integer> departures = calendar.scheduleFor(lineCode, serviceDay).departures();
            for (RouteTimings timings : byDirection.values()) {
                if (timings.stops().size() < 2) {
                    continue;
                }
                int originDwell = Math.max(0, timings.stops().getFirst().station().dwellTimeSeconds());
                for (int departure : departures) {
                    long elapsed = secondsIntoDay - departure;
                    if (elapsed < -originDwell || elapsed >= timings.totalSeconds()) {
                        continue;
                    }
                    String tripId = "%s/%s-%s-%s".formatted(serviceDay, lineCode, timings.direction().name().charAt(0),
                            MetroTime.formatServiceTime(departure).replace(":", ""));
                    String label = "%s%s%s".formatted(lineCode.charAt(0),
                            MetroTime.formatServiceTime(departure).replace(":", ""),
                            timings.direction() == TrainDirection.OUTBOUND ? "↑" : "↓");
                    positions.add(position(timings, elapsed, tripId, label, now));
                    updates.add(tripUpdate(timings, elapsed, tripId, serviceDay, departure, now));
                }
            }
        }
        return new ProviderSnapshot(positions, updates, List.of(), now, List.of());
    }

    private VehiclePosition position(RouteTimings timings, long elapsed, String tripId, String label, Instant now) {
        List<RouteTimings.Stop> stops = timings.stops();
        int directionId = timings.direction() == TrainDirection.OUTBOUND ? 0 : 1;

        if (elapsed < 0) {
            return standing(timings, stops.getFirst(), tripId, label, directionId, now);
        }
        for (int i = 1; i < stops.size(); i++) {
            RouteTimings.Stop stop = stops.get(i);
            if (elapsed < stop.arrivalOffset()) {
                RouteTimings.Stop previous = stops.get(i - 1);
                Track leg = timings.legs().get(i - 1);
                int legStart = previous.departureOffset();
                int travel = stop.arrivalOffset() - legStart;
                double fraction = travel <= 0 ? 1 : (double) (elapsed - legStart) / travel;
                Coordinates at = TrackGeometry.interpolate(
                        TrackGeometry.polyline(leg, previous.station(), stop.station()), fraction);
                long remaining = stop.arrivalOffset() - elapsed;
                VehicleStopStatus status = remaining <= INCOMING_WINDOW_SECONDS
                        ? VehicleStopStatus.INCOMING_AT : VehicleStopStatus.IN_TRANSIT_TO;
                double speed = travel <= 0 ? 0 : (double) leg.distanceMetres() / travel;
                return new VehiclePosition(tripId, label, tripId, timings.lineCode(), directionId,
                        stop.station().code(), status, at.latitude(), at.longitude(), null, speed, now);
            }
            if (elapsed < stop.departureOffset()) {
                return standing(timings, stop, tripId, label, directionId, now);
            }
        }
        return standing(timings, stops.getLast(), tripId, label, directionId, now);
    }

    private VehiclePosition standing(RouteTimings timings, RouteTimings.Stop stop, String tripId, String label,
                                     int directionId, Instant now) {
        Coordinates at = stop.station().coordinates();
        return new VehiclePosition(tripId, label, tripId, timings.lineCode(), directionId, stop.station().code(),
                VehicleStopStatus.STOPPED_AT, at.latitude(), at.longitude(), null, 0.0, now);
    }

    /** The remaining stops, at timetabled times. Delay is null: a timetable knows no delays. */
    private TripUpdate tripUpdate(RouteTimings timings, long elapsed, String tripId, LocalDate serviceDay,
                                  int departure, Instant now) {
        List<TripUpdate.StopTimeUpdate> remaining = new ArrayList<>();
        for (int i = 0; i < timings.stops().size(); i++) {
            RouteTimings.Stop stop = timings.stops().get(i);
            if (stop.departureOffset() < elapsed && i < timings.stops().size() - 1) {
                continue;
            }
            Instant arrival = MetroTime.atServiceDaySeconds(serviceDay, (long) departure + stop.arrivalOffset());
            Instant leaves = MetroTime.atServiceDaySeconds(serviceDay, (long) departure + stop.departureOffset());
            remaining.add(new TripUpdate.StopTimeUpdate(stop.station().code(), i + 1, arrival, leaves, null, false));
        }
        int directionId = timings.direction() == TrainDirection.OUTBOUND ? 0 : 1;
        return new TripUpdate(tripId, timings.lineCode(), directionId, tripId, remaining, now);
    }
}
