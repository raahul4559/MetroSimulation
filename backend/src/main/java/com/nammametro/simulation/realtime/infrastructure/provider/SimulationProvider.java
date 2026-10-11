package com.nammametro.simulation.realtime.infrastructure.provider;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.application.FeedMapping;
import com.nammametro.simulation.realtime.application.MetroRealtimeProvider;
import com.nammametro.simulation.realtime.application.TrackGeometry;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * The discrete-time simulation engine, exposed through the same provider interface as every other
 * source — the {@link DataSource#SIMULATION} source.
 *
 * <p>When the simulation is the active source, {@code MetroStateManager} takes its trains straight
 * from {@link TrainSimulationControlUseCase#getState()} rather than through this feed-shaped view:
 * the simulation has strictly richer state (signals, passengers, one-tick statuses such as
 * {@code AT_STATION}) that a GTFS-shaped round trip would flatten, and the existing simulation
 * behaviour must not change. This view exists so the simulation can also be inspected — and
 * exported — exactly as an external feed would see it ({@code GET
 * /api/realtime/providers/SIMULATION/feed}).
 */
public class SimulationProvider implements MetroRealtimeProvider {

    private final TrainSimulationControlUseCase simulation;
    private final MetroNetwork network;

    public SimulationProvider(TrainSimulationControlUseCase simulation, MetroNetwork network) {
        this.simulation = simulation;
        this.network = network;
    }

    @Override
    public DataSource source() {
        return DataSource.SIMULATION;
    }

    @Override
    public String name() {
        return "Simulation";
    }

    @Override
    public boolean isConfigured() {
        return true;
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
        List<VehiclePosition> positions = new ArrayList<>();
        for (TrainState train : simulation.getState().trains()) {
            if (train.status() == TrainStatus.SCHEDULED || train.status() == TrainStatus.COMPLETED) {
                continue;
            }
            Station next = station(train.nextStationId());
            Station previous = station(train.previousStationId());
            int directionId = train.direction() == TrainDirection.OUTBOUND ? 0 : 1;
            boolean atPlatform = train.currentTrackId() == null;
            Coordinates at = atPlatform ? previous.coordinates() : interpolate(train, previous, next);
            VehicleStopStatus status = atPlatform ? VehicleStopStatus.STOPPED_AT
                    : train.status() == TrainStatus.ARRIVING ? VehicleStopStatus.INCOMING_AT : VehicleStopStatus.IN_TRANSIT_TO;
            String stopId = atPlatform ? previous.code() : next.code();
            positions.add(new VehiclePosition(train.code(), train.code(), train.code(), train.lineCode(), directionId,
                    stopId, status, at.latitude(), at.longitude(), null, train.speedKmph() / 3.6, now));
        }
        return positions;
    }

    @Override
    public List<TripUpdate> getTripUpdates(Instant now) {
        List<TripUpdate> updates = new ArrayList<>();
        for (TrainState train : simulation.getState().trains()) {
            if (train.status() == TrainStatus.SCHEDULED || train.status() == TrainStatus.COMPLETED
                    || train.currentTrackId() == null) {
                continue;
            }
            Optional<Track> track = network.allTracks().stream().filter(t -> t.id() == train.currentTrackId()).findFirst();
            if (track.isEmpty()) {
                continue;
            }
            // Simulated seconds, not wall seconds — only meaningful at 1x, which is what an
            // export of the simulation as a feed would run at.
            long remaining = Math.round((1 - train.progress()) * track.get().expectedTravelTimeSeconds());
            Station next = station(train.nextStationId());
            updates.add(new TripUpdate(train.code(), train.lineCode(),
                    train.direction() == TrainDirection.OUTBOUND ? 0 : 1, train.code(),
                    List.of(new TripUpdate.StopTimeUpdate(next.code(), null, now.plusSeconds(remaining), null,
                            train.delaySeconds(), false)),
                    now));
        }
        return updates;
    }

    /** Active injected disruptions, as alerts. */
    @Override
    public List<ServiceAlert> getServiceAlerts(Instant now) {
        List<ServiceAlert> alerts = new ArrayList<>();
        for (Disruption disruption : simulation.getState().disruptions()) {
            if (!disruption.isActive()) {
                continue;
            }
            List<String> routes = new ArrayList<>();
            List<String> stops = new ArrayList<>();
            switch (disruption.resourceType()) {
                case STATION -> network.findStation(disruption.resourceId()).ifPresent(s -> stops.add(s.code()));
                case TRACK -> network.allTracks().stream().filter(t -> t.id() == disruption.resourceId()).findFirst()
                        .ifPresent(t -> routes.add(t.lineCode()));
                case TRAIN -> simulation.getState().trains().stream().filter(t -> t.id() == disruption.resourceId())
                        .findFirst().ifPresent(t -> routes.add(t.lineCode()));
            }
            alerts.add(new ServiceAlert("sim-" + disruption.id(), disruption.type().name(), "SIGNIFICANT_DELAYS",
                    ServiceAlert.AlertSeverity.WARNING, disruption.type().name().replace('_', ' '),
                    disruption.description(), null, null, routes, stops));
        }
        return alerts;
    }

    private Station station(long id) {
        return network.findStation(id).orElseThrow();
    }

    private Coordinates interpolate(TrainState train, Station previous, Station next) {
        return network.allTracks().stream().filter(t -> t.id() == train.currentTrackId()).findFirst()
                .map(track -> TrackGeometry.interpolate(TrackGeometry.polyline(track, previous, next), train.progress()))
                .orElse(previous.coordinates());
    }
}
