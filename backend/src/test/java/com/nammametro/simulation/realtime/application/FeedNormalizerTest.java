package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class FeedNormalizerTest {

    private static final Instant NOW = Instant.parse("2026-10-12T04:00:00Z");
    private static final FeedMapping MAPPING = new FeedMapping(
            Map.of("stop-b", "B"), Map.of("route-7", "PURPLE"), Map.of(0, TrainDirection.OUTBOUND, 1, TrainDirection.INBOUND));

    private final FeedNormalizer normalizer = new FeedNormalizer(RealtimeFixtures.network(), RealtimeSettings.defaults());

    private static VehiclePosition vehicle(String id, String route, Integer direction, String stop, VehicleStopStatus status,
                                           Double lat, Double lng, Instant at) {
        return new VehiclePosition(id, null, null, route, direction, stop, status, lat, lng, null, null, at);
    }

    private FeedNormalizer.Result normalize(VehiclePosition... vehicles) {
        return normalizer.normalize(DataSource.GTFS_REALTIME, MAPPING,
                new ProviderSnapshot(List.of(vehicles), List.of(), List.of(), NOW, List.of()), NOW);
    }

    @Test
    void stoppedAtAMappedStationIsPlacedAtThePlatformWithItsSource() {
        var result = normalize(vehicle("v1", "route-7", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null, NOW));

        assertThat(result.rejections()).isEmpty();
        MetroTrain train = result.trains().getFirst();
        assertThat(train.source()).isEqualTo(DataSource.GTFS_REALTIME);
        assertThat(train.previousStationId()).isEqualTo(2);
        assertThat(train.nextStationId()).isEqualTo(2);
        assertThat(train.status()).isEqualTo(TrainStatus.DWELLING);
        assertThat(train.direction()).isEqualTo(TrainDirection.OUTBOUND);
        // A feed reports no passengers and no delay: unknown, never a fabricated zero.
        assertThat(train.passengerCount()).isNull();
        assertThat(train.delaySeconds()).isNull();
    }

    @Test
    void coordinatesAreProjectedOntoTheLegTowardTheNextStop() {
        // A quarter of the way from A (77.50) to B (77.51).
        var result = normalize(vehicle("v1", "route-7", null, "stop-b", VehicleStopStatus.IN_TRANSIT_TO, 12.97, 77.5025, NOW));

        MetroTrain train = result.trains().getFirst();
        assertThat(train.previousStationId()).isEqualTo(1);
        assertThat(train.nextStationId()).isEqualTo(2);
        assertThat(train.currentTrackId()).isEqualTo(11L);
        assertThat(train.progress()).isCloseTo(0.25, within(0.01));
        assertThat(train.direction()).isEqualTo(TrainDirection.OUTBOUND);
        assertThat(train.positionEstimated()).isFalse();
    }

    @Test
    void unplaceableVehiclesAreRejectedWithReasonsNotGuessed() {
        var result = normalize(
                vehicle("unknown-route", "route-99", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null, NOW),
                vehicle("no-direction", "route-7", null, "stop-b", VehicleStopStatus.STOPPED_AT, null, null, NOW),
                vehicle("far-away", "route-7", 0, null, VehicleStopStatus.IN_TRANSIT_TO, 13.10, 77.51, NOW),
                vehicle("ancient", "route-7", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null, NOW.minusSeconds(3600)),
                vehicle(null, "route-7", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null, NOW));

        assertThat(result.trains()).isEmpty();
        assertThat(result.rejections()).containsExactlyInAnyOrderEntriesOf(Map.of(
                FeedNormalizer.REJECT_UNKNOWN_ROUTE, 1,
                FeedNormalizer.REJECT_AMBIGUOUS_DIRECTION, 1,
                FeedNormalizer.REJECT_OFF_NETWORK, 1,
                FeedNormalizer.REJECT_EXPIRED, 1,
                FeedNormalizer.REJECT_MISSING_ID, 1));
    }

    @Test
    void oldButUnexpiredObservationsAreMarkedStale() {
        var result = normalize(vehicle("v1", "route-7", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null,
                NOW.minusSeconds(120)));

        assertThat(result.trains().getFirst().stale()).isTrue();
    }

    @Test
    void futureTimestampsAreClampedToServerTimeAndWarned() {
        var result = normalize(vehicle("v1", "route-7", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null,
                NOW.plusSeconds(600)));

        assertThat(result.trains().getFirst().observedAt()).isEqualTo(NOW);
        assertThat(result.warnings()).anyMatch(w -> w.contains("future"));
    }

    @Test
    void duplicateVehicleKeepsTheNewerObservation() {
        var result = normalize(
                vehicle("v1", "route-7", 0, "stop-b", VehicleStopStatus.STOPPED_AT, null, null, NOW.minusSeconds(20)),
                vehicle("v1", "route-7", 0, "stop-b", VehicleStopStatus.IN_TRANSIT_TO, 12.97, 77.505, NOW));

        assertThat(result.trains()).hasSize(1);
        assertThat(result.trains().getFirst().observedAt()).isEqualTo(NOW);
    }

    @Test
    void directionIsInferredFromTripUpdateStopOrder() {
        VehiclePosition v = new VehiclePosition("v1", null, "trip-1", "route-7", null, "stop-b",
                VehicleStopStatus.STOPPED_AT, null, null, null, null, NOW);
        TripUpdate update = new TripUpdate("trip-1", "route-7", null, null, List.of(
                new TripUpdate.StopTimeUpdate("stop-b", 2, NOW, NOW, 45, false),
                new TripUpdate.StopTimeUpdate("A", 3, NOW.plusSeconds(90), null, 45, false)), NOW);

        var result = normalizer.normalize(DataSource.LIVE, new FeedMapping(Map.of("stop-b", "B"), Map.of("route-7", "PURPLE"), Map.of()),
                new ProviderSnapshot(List.of(v), List.of(update), List.of(), NOW, List.of()), NOW);

        MetroTrain train = result.trains().getFirst();
        assertThat(train.direction()).isEqualTo(TrainDirection.INBOUND);
        assertThat(train.delaySeconds()).isEqualTo(45);
        assertThat(train.source()).isEqualTo(DataSource.LIVE);
    }

    @Test
    void alertsResolveMappedIdsAndKeepUnmappedAlerts() {
        ServiceAlert alert = new ServiceAlert("a1", "TECHNICAL_PROBLEM", "NO_SERVICE", ServiceAlert.AlertSeverity.SEVERE,
                "Purple line suspended", null, null, null, List.of("route-7", "route-x"), List.of("stop-b", "stop-z"));
        ServiceAlert expired = new ServiceAlert("a2", null, null, null, "Old", null, null, NOW.minusSeconds(1),
                List.of(), List.of());

        var alerts = normalizer.normalizeAlerts(DataSource.GTFS_REALTIME, MAPPING, List.of(alert, expired), NOW);

        assertThat(alerts).hasSize(1);
        assertThat(alerts.getFirst().lineCodes()).containsExactly("PURPLE");
        assertThat(alerts.getFirst().stationIds()).containsExactly(2L);
        assertThat(alerts.getFirst().suspendsService()).isTrue();
    }

    @Test
    void anUnmappedRouteIsIdentifiedFromCoordinatesOnTheTrackGraph() {
        // A route id this mapping doesn't know, but coordinates 40% of the way along A -> B.
        var result = normalize(vehicle("v1", "unmapped-route", 0, null, VehicleStopStatus.IN_TRANSIT_TO, 12.97, 77.504, NOW));

        assertThat(result.rejections()).isEmpty();
        MetroTrain train = result.trains().getFirst();
        assertThat(train.lineCode()).isEqualTo("PURPLE");
        assertThat(train.currentTrackId()).isEqualTo(11L);
        assertThat(train.progress()).isCloseTo(0.4, within(0.01));
    }

    @Test
    void coordinatesBetweenTwoParallelLinesAreRejectedNotGuessed() {
        MetroNetwork network = RealtimeFixtures.network();
        // A second line 50 m north of PURPLE, sharing no stations.
        Station d = new Station(4, "D", "Delta", new Coordinates(12.97045, 77.50), List.of("GREEN"), StationType.TERMINAL, 30);
        Station e = new Station(5, "E", "Echo", new Coordinates(12.97045, 77.51), List.of("GREEN"), StationType.TERMINAL, 30);
        network.addStation(d);
        network.addStation(e);
        network.addLine(new Line(2, "GREEN", "Green Line", "#00FF00", List.of(d, e)));
        network.addTrack(new Track(21, "GREEN", d.id(), e.id(), 1086, 60, List.of()));
        FeedNormalizer twoLines = new FeedNormalizer(network, RealtimeSettings.defaults());

        var result = twoLines.normalize(DataSource.GTFS_REALTIME, MAPPING, new ProviderSnapshot(List.of(
                vehicle("v1", null, 0, null, VehicleStopStatus.IN_TRANSIT_TO, 12.97022, 77.505, NOW)),
                List.of(), List.of(), NOW, List.of()), NOW);

        assertThat(result.trains()).isEmpty();
        assertThat(result.rejections()).containsEntry(FeedNormalizer.REJECT_AMBIGUOUS_ROUTE, 1);
    }
}
