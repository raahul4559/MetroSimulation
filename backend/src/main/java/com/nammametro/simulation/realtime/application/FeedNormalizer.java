package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroAlert;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.TripUpdate.StopTimeUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Validation and normalization: turns one provider's raw {@link ProviderSnapshot} into canonical
 * {@link MetroTrain}s placed on this network, plus resolved {@link MetroAlert}s. Pure — no Spring,
 * no clock reads, no I/O — so every placement rule is exercised directly in a test.
 *
 * <p>A vehicle that can't be placed honestly is <em>rejected with a reason</em>, never guessed onto
 * the map: unknown route, missing ids, expired timestamps, coordinates far from the line, a stopped
 * train whose direction the feed doesn't reveal. Rejection counts are reported in the provider's
 * health so the operator can see (and fix, via {@link FeedMapping}) what isn't landing.
 *
 * <p>Placement, in order of preference:
 * <ol>
 *   <li>{@code STOPPED_AT} a mapped station → at the platform ({@code previousStationId ==
 *       nextStationId}, {@code DWELLING} — the same convention the simulation uses).</li>
 *   <li>Heading to a mapped station → on the leg into it. Coordinates (projected onto the leg) give
 *       progress; without them, the trip update's ETA does; without either, mid-leg flagged
 *       {@code positionEstimated}.</li>
 *   <li>Heading to an unmapped station (this network models a subset of the real one) but with
 *       coordinates → snapped onto the nearest leg of its line, if within
 *       {@link RealtimeSettings#maxSnapDistanceMetres()}.</li>
 * </ol>
 */
public final class FeedNormalizer {

    public static final String REJECT_MISSING_ID = "MISSING_ID";
    public static final String REJECT_EXPIRED = "EXPIRED";
    public static final String REJECT_UNKNOWN_ROUTE = "UNKNOWN_ROUTE";
    public static final String REJECT_AMBIGUOUS_DIRECTION = "AMBIGUOUS_DIRECTION";
    public static final String REJECT_OFF_NETWORK = "OFF_NETWORK";
    public static final String REJECT_NO_POSITION = "NO_POSITION";

    /** Roughly Bengaluru's metro catchment, padded. Coordinates outside it are ignored, not trusted. */
    private static final double PAD_DEGREES = 0.25;

    private final MetroNetwork network;
    private final RealtimeSettings settings;
    private final double minLat;
    private final double maxLat;
    private final double minLng;
    private final double maxLng;

    public FeedNormalizer(MetroNetwork network, RealtimeSettings settings) {
        this.network = network;
        this.settings = settings;
        this.minLat = network.allStations().stream().mapToDouble(s -> s.coordinates().latitude()).min().orElse(0) - PAD_DEGREES;
        this.maxLat = network.allStations().stream().mapToDouble(s -> s.coordinates().latitude()).max().orElse(0) + PAD_DEGREES;
        this.minLng = network.allStations().stream().mapToDouble(s -> s.coordinates().longitude()).min().orElse(0) - PAD_DEGREES;
        this.maxLng = network.allStations().stream().mapToDouble(s -> s.coordinates().longitude()).max().orElse(0) + PAD_DEGREES;
    }

    public record Result(
            List<MetroTrain> trains,
            List<MetroAlert> alerts,
            Map<String, Integer> rejections,
            List<String> warnings
    ) {

        public int rejectedCount() {
            return rejections.values().stream().mapToInt(Integer::intValue).sum();
        }
    }

    public Result normalize(DataSource source, FeedMapping mapping, ProviderSnapshot snapshot, Instant fetchedAt) {
        Map<String, Integer> rejections = new TreeMap<>();
        List<String> warnings = new ArrayList<>(snapshot.warnings());
        int skewed = 0;

        Map<String, TripUpdate> updatesByTrip = new HashMap<>();
        Map<String, TripUpdate> updatesByVehicle = new HashMap<>();
        for (TripUpdate update : snapshot.tripUpdates()) {
            if (update.tripId() != null) {
                updatesByTrip.put(update.tripId(), update);
            }
            if (update.vehicleId() != null) {
                updatesByVehicle.put(update.vehicleId(), update);
            }
        }

        // One entry per physical vehicle — a feed listing the same vehicle twice keeps the newer.
        Map<String, MetroTrain> byKey = new LinkedHashMap<>();
        for (VehiclePosition vehicle : snapshot.vehiclePositions()) {
            String key = firstNonBlank(vehicle.vehicleId(), vehicle.tripId());
            if (key == null) {
                reject(rejections, REJECT_MISSING_ID);
                continue;
            }

            Instant observedAt = firstNonNull(vehicle.timestamp(), snapshot.feedTimestamp(), fetchedAt);
            if (observedAt.isAfter(fetchedAt)) {
                if (Duration.between(fetchedAt, observedAt).compareTo(settings.maxClockSkew()) > 0) {
                    skewed++;
                }
                observedAt = fetchedAt;
            }
            if (Duration.between(observedAt, fetchedAt).compareTo(settings.expireAfter()) > 0) {
                reject(rejections, REJECT_EXPIRED);
                continue;
            }

            TripUpdate update = Optional.ofNullable(vehicle.tripId()).map(updatesByTrip::get)
                    .or(() -> Optional.ofNullable(vehicle.vehicleId()).map(updatesByVehicle::get))
                    .orElse(null);

            String routeId = vehicle.routeId() != null ? vehicle.routeId() : update != null ? update.routeId() : null;
            Optional<Line> line = mapping.line(routeId, network);
            if (line.isEmpty()) {
                reject(rejections, REJECT_UNKNOWN_ROUTE);
                continue;
            }

            Placement placement = place(vehicle, update, line.get(), mapping, fetchedAt);
            if (placement.rejection() != null) {
                reject(rejections, placement.rejection());
                continue;
            }

            MetroTrain train = toTrain(source, mapping, vehicle, update, line.get(), placement, observedAt, key);
            MetroTrain existing = byKey.get(key);
            if (existing == null || existing.observedAt().isBefore(train.observedAt())) {
                byKey.put(key, train);
            }
        }

        if (skewed > 0) {
            warnings.add("%d vehicle timestamp(s) were more than %ds in the future and were clamped to server time"
                    .formatted(skewed, settings.maxClockSkew().toSeconds()));
        }

        List<MetroTrain> trains = byKey.values().stream()
                .map(t -> t.withStale(Duration.between(t.observedAt(), fetchedAt).compareTo(settings.staleAfter()) > 0))
                .toList();
        return new Result(trains, normalizeAlerts(source, mapping, snapshot.serviceAlerts(), fetchedAt),
                rejections, warnings);
    }

    public List<MetroAlert> normalizeAlerts(DataSource source, FeedMapping mapping, List<ServiceAlert> alerts,
                                            Instant now) {
        List<MetroAlert> resolved = new ArrayList<>();
        for (ServiceAlert alert : alerts) {
            if (!alert.isActiveAt(now)) {
                continue;
            }
            List<String> lineCodes = alert.routeIds().stream()
                    .map(id -> mapping.line(id, network)).flatMap(Optional::stream).map(Line::code).distinct().toList();
            List<Long> stationIds = alert.stopIds().stream()
                    .map(id -> mapping.station(id, network)).flatMap(Optional::stream).map(Station::id).distinct().toList();
            resolved.add(new MetroAlert(
                    Objects.requireNonNullElse(alert.id(), source.name() + "-" + resolved.size()), source,
                    alert.cause(), alert.effect(), alert.severity(), alert.headerText(), alert.descriptionText(),
                    alert.activeFrom(), alert.activeUntil(), lineCodes, stationIds));
        }
        return resolved;
    }

    // --- placement ------------------------------------------------------------------------------

    private record Placement(long previousStationId, long nextStationId, Long trackId, double progress,
                             TrainStatus status, TrainDirection direction, boolean estimated, String rejection) {

        static Placement rejected(String reason) {
            return new Placement(0, 0, null, 0, null, null, false, reason);
        }
    }

    private Placement place(VehiclePosition vehicle, TripUpdate update, Line line, FeedMapping mapping, Instant now) {
        List<Station> stations = line.orderedStations();
        Coordinates coordinates = usableCoordinates(vehicle);
        Optional<TrainDirection> hinted = mapping.direction(vehicle.directionId())
                .or(() -> update == null ? Optional.empty() : mapping.direction(update.directionId()))
                .or(() -> directionFromStopOrder(update, line, mapping));

        Optional<Station> stop = mapping.station(vehicle.stopId(), network).filter(s -> stations.contains(s));
        VehicleStopStatus status = vehicle.currentStatus() == null ? VehicleStopStatus.IN_TRANSIT_TO : vehicle.currentStatus();

        if (stop.isPresent() && status == VehicleStopStatus.STOPPED_AT) {
            if (hinted.isEmpty()) {
                return Placement.rejected(REJECT_AMBIGUOUS_DIRECTION);
            }
            long id = stop.get().id();
            return new Placement(id, id, null, 0, TrainStatus.DWELLING, hinted.get(), false, null);
        }

        TrainStatus movingStatus = status == VehicleStopStatus.INCOMING_AT ? TrainStatus.ARRIVING : TrainStatus.RUNNING;

        if (stop.isPresent()) {
            return placeTowardStation(stop.get(), stations, line, coordinates, hinted, update, mapping, movingStatus, now);
        }
        if (coordinates != null) {
            return snapToLine(stations, coordinates, hinted, vehicle.bearingDegrees(), movingStatus);
        }
        return Placement.rejected(REJECT_NO_POSITION);
    }

    private Placement placeTowardStation(Station next, List<Station> stations, Line line, Coordinates coordinates,
                                         Optional<TrainDirection> hinted, TripUpdate update, FeedMapping mapping,
                                         TrainStatus movingStatus, Instant now) {
        int index = stations.indexOf(next);
        List<Station> candidates = new ArrayList<>(2);
        if (hinted.isEmpty() || hinted.get() == TrainDirection.OUTBOUND) {
            if (index > 0) {
                candidates.add(stations.get(index - 1));
            }
        }
        if (hinted.isEmpty() || hinted.get() == TrainDirection.INBOUND) {
            if (index < stations.size() - 1) {
                candidates.add(stations.get(index + 1));
            }
        }
        if (candidates.isEmpty()) {
            return Placement.rejected(REJECT_AMBIGUOUS_DIRECTION);
        }

        if (coordinates != null) {
            Station bestPrevious = null;
            TrackGeometry.Projection best = null;
            Track bestTrack = null;
            for (Station previous : candidates) {
                Optional<Track> track = network.getSingleTrackBetween(previous.id(), next.id());
                if (track.isEmpty()) {
                    continue;
                }
                TrackGeometry.Projection projection = TrackGeometry.project(
                        TrackGeometry.polyline(track.get(), previous, next), coordinates.latitude(), coordinates.longitude());
                if (best == null || projection.distanceMetres() < best.distanceMetres()) {
                    best = projection;
                    bestPrevious = previous;
                    bestTrack = track.get();
                }
            }
            if (best == null || best.distanceMetres() > settings.maxSnapDistanceMetres()) {
                return Placement.rejected(REJECT_OFF_NETWORK);
            }
            return new Placement(bestPrevious.id(), next.id(), bestTrack.id(), best.progress(), movingStatus,
                    directionOf(stations, bestPrevious, next), false, null);
        }

        if (candidates.size() != 1) {
            return Placement.rejected(REJECT_AMBIGUOUS_DIRECTION);
        }
        Station previous = candidates.getFirst();
        Optional<Track> track = network.getSingleTrackBetween(previous.id(), next.id());
        if (track.isEmpty()) {
            return Placement.rejected(REJECT_NO_POSITION);
        }
        double progress = 0.5;
        Optional<Instant> eta = arrivalAt(update, next, mapping);
        if (eta.isPresent() && track.get().expectedTravelTimeSeconds() > 0) {
            double remaining = Duration.between(now, eta.get()).toMillis() / 1000.0;
            progress = Math.clamp(1 - remaining / track.get().expectedTravelTimeSeconds(), 0, 0.99);
        }
        return new Placement(previous.id(), next.id(), track.get().id(), progress, movingStatus,
                directionOf(stations, previous, next), true, null);
    }

    private Placement snapToLine(List<Station> stations, Coordinates coordinates, Optional<TrainDirection> hinted,
                                 Double bearing, TrainStatus movingStatus) {
        TrackGeometry.Projection best = null;
        int bestIndex = -1;
        Track bestTrack = null;
        for (int i = 0; i < stations.size() - 1; i++) {
            Station a = stations.get(i);
            Station b = stations.get(i + 1);
            Optional<Track> track = network.getSingleTrackBetween(a.id(), b.id());
            if (track.isEmpty()) {
                continue;
            }
            TrackGeometry.Projection projection = TrackGeometry.project(
                    TrackGeometry.polyline(track.get(), a, b), coordinates.latitude(), coordinates.longitude());
            if (best == null || projection.distanceMetres() < best.distanceMetres()) {
                best = projection;
                bestIndex = i;
                bestTrack = track.get();
            }
        }
        if (best == null || best.distanceMetres() > settings.maxSnapDistanceMetres()) {
            return Placement.rejected(REJECT_OFF_NETWORK);
        }

        Station a = stations.get(bestIndex);
        Station b = stations.get(bestIndex + 1);
        Optional<TrainDirection> direction = hinted;
        if (direction.isEmpty() && bearing != null) {
            double legBearing = TrackGeometry.bearingDegrees(a.coordinates(), b.coordinates());
            double difference = Math.abs(((bearing - legBearing) % 360 + 540) % 360 - 180);
            direction = Optional.of(difference < 90 ? TrainDirection.OUTBOUND : TrainDirection.INBOUND);
        }
        if (direction.isEmpty()) {
            return Placement.rejected(REJECT_AMBIGUOUS_DIRECTION);
        }
        // The leg is between stations this network models; the train is genuinely somewhere on it,
        // but its real next stop may be a station this dataset omits — hence "estimated".
        return direction.get() == TrainDirection.OUTBOUND
                ? new Placement(a.id(), b.id(), bestTrack.id(), best.progress(), movingStatus, TrainDirection.OUTBOUND, true, null)
                : new Placement(b.id(), a.id(), bestTrack.id(), 1 - best.progress(), movingStatus, TrainDirection.INBOUND, true, null);
    }

    /** Direction implied by the order of a trip update's remaining mapped stops on the line. */
    private Optional<TrainDirection> directionFromStopOrder(TripUpdate update, Line line, FeedMapping mapping) {
        if (update == null) {
            return Optional.empty();
        }
        List<Integer> indices = update.stopTimeUpdates().stream()
                .filter(stu -> !stu.skipped())
                .map(stu -> mapping.station(stu.stopId(), network))
                .flatMap(Optional::stream)
                .map(s -> line.orderedStations().indexOf(s))
                .filter(i -> i >= 0)
                .distinct()
                .toList();
        if (indices.size() < 2) {
            return Optional.empty();
        }
        return Optional.of(indices.get(1) > indices.get(0) ? TrainDirection.OUTBOUND : TrainDirection.INBOUND);
    }

    private Optional<Instant> arrivalAt(TripUpdate update, Station station, FeedMapping mapping) {
        return stopUpdateFor(update, station, mapping).map(stu -> stu.arrivalTime() != null ? stu.arrivalTime() : stu.departureTime());
    }

    private Optional<StopTimeUpdate> stopUpdateFor(TripUpdate update, Station station, FeedMapping mapping) {
        if (update == null) {
            return Optional.empty();
        }
        return update.stopTimeUpdates().stream()
                .filter(stu -> mapping.station(stu.stopId(), network).map(s -> s.id() == station.id()).orElse(false))
                .findFirst();
    }

    private TrainDirection directionOf(List<Station> stations, Station previous, Station next) {
        return stations.indexOf(previous) < stations.indexOf(next) ? TrainDirection.OUTBOUND : TrainDirection.INBOUND;
    }

    private Coordinates usableCoordinates(VehiclePosition vehicle) {
        if (!vehicle.hasCoordinates()) {
            return null;
        }
        double lat = vehicle.latitude();
        double lng = vehicle.longitude();
        if (!Double.isFinite(lat) || !Double.isFinite(lng) || lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
            return null;
        }
        return new Coordinates(lat, lng);
    }

    private MetroTrain toTrain(DataSource source, FeedMapping mapping, VehiclePosition vehicle, TripUpdate update,
                               Line line, Placement placement, Instant observedAt, String key) {
        Station next = network.findStation(placement.nextStationId()).orElseThrow();
        Optional<StopTimeUpdate> nextStop = stopUpdateFor(update, next, mapping);
        Integer delay = nextStop.map(StopTimeUpdate::delaySeconds)
                .or(() -> update == null ? Optional.empty()
                        : update.stopTimeUpdates().stream().map(StopTimeUpdate::delaySeconds).filter(Objects::nonNull).findFirst())
                .orElse(null);
        Instant eta = nextStop.map(stu -> stu.arrivalTime() != null ? stu.arrivalTime() : stu.departureTime()).orElse(null);
        Double speedKmph = vehicle.speedMetresPerSecond() == null ? null : vehicle.speedMetresPerSecond() * 3.6;
        if (placement.status() == TrainStatus.DWELLING && speedKmph == null) {
            speedKmph = 0.0;
        }
        String code = firstNonBlank(vehicle.vehicleLabel(), vehicle.vehicleId(), vehicle.tripId());
        Coordinates position = usableCoordinates(vehicle);

        return new MetroTrain(0, code, line.code(), placement.direction(), placement.trackId(),
                placement.previousStationId(), placement.nextStationId(), placement.progress(), speedKmph,
                placement.status(), null, null, delay, eta, position,
                null, null, null, null, null, null, null, null,
                source, vehicle.vehicleId() != null ? vehicle.vehicleId() : key, vehicle.tripId(), observedAt,
                false, placement.estimated());
    }

    private static void reject(Map<String, Integer> rejections, String reason) {
        rejections.merge(reason, 1, Integer::sum);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
