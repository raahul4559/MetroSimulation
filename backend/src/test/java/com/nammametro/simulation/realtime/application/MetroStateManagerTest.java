package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.api.rest.dto.MetroStateResponse;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroState;
import com.nammametro.simulation.realtime.domain.ProviderHealth;
import com.nammametro.simulation.realtime.domain.ProviderHealth.ProviderStatus;
import com.nammametro.simulation.realtime.domain.ProviderSnapshot;
import com.nammametro.simulation.realtime.domain.RealtimeMode;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.TripUpdate;
import com.nammametro.simulation.realtime.domain.VehiclePosition;
import com.nammametro.simulation.realtime.domain.VehicleStopStatus;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MetroStateManagerTest {

    private static final Instant T0 = Instant.parse("2026-10-12T04:00:00Z");

    private final MutableClock clock = new MutableClock(T0);
    private final MetroNetwork network = RealtimeFixtures.network();
    private final List<MetroState> published = new ArrayList<>();
    private final FakeFeed gtfs = new FakeFeed(DataSource.GTFS_REALTIME, true);
    private final FakeFeed official = new FakeFeed(DataSource.LIVE, false);

    private MetroStateManager manager(RealtimeMode mode) {
        ServiceCalendar calendar = new ServiceCalendar(Timetable.empty(), network);
        List<MetroRealtimeProvider> providers = List.of(official, gtfs,
                new com.nammametro.simulation.realtime.infrastructure.provider.ScheduleProvider(network, calendar),
                new com.nammametro.simulation.realtime.infrastructure.provider.SimulationProvider(
                        RealtimeFixtures.simulation(RealtimeFixtures.simulationState(SimulationStatus.PAUSED)), network));
        return new MetroStateManager(clock, network, calendar, RealtimeSettings.defaults(), providers,
                RealtimeFixtures.simulation(RealtimeFixtures.simulationState(SimulationStatus.PAUSED)),
                published::add, mode, Duration.ofMinutes(5));
    }

    private static VehiclePosition atB(String id, Instant at) {
        return new VehiclePosition(id, id, null, "PURPLE", 0, "B", VehicleStopStatus.STOPPED_AT, null, null, null, null, at);
    }

    @Test
    void withNoFeedConfiguredAutoFallsBackToTheSimulationAndNeverCallsItLive() {
        gtfs.configured = false;
        MetroStateManager manager = manager(RealtimeMode.AUTO);

        MetroState state = manager.publishNow();

        assertThat(state.activeSource()).isEqualTo(DataSource.SIMULATION);
        assertThat(state.simulation()).isNotNull();
        assertThat(state.timezone()).isEqualTo("Asia/Kolkata");
        assertThat(state.providers()).extracting(ProviderHealth::status)
                .containsExactly(ProviderStatus.UNCONFIGURED, ProviderStatus.UNCONFIGURED, ProviderStatus.UNCONFIGURED,
                        ProviderStatus.HEALTHY);
        assertThat(MetroStateResponse.from(state).isLive()).isFalse();
        assertThat(published).containsExactly(state);
    }

    @Test
    void autoPrefersAHealthyObservedFeedAndLabelsItsTrains() {
        gtfs.snapshot = new ProviderSnapshot(List.of(atB("v1", T0)), List.of(), List.of(), T0, List.of());
        MetroStateManager manager = manager(RealtimeMode.AUTO);

        manager.pollOnce(DataSource.GTFS_REALTIME);
        MetroState state = manager.publishNow();

        assertThat(state.activeSource()).isEqualTo(DataSource.GTFS_REALTIME);
        assertThat(state.simulation()).isNull();
        assertThat(state.trains()).singleElement().satisfies(t -> {
            assertThat(t.source()).isEqualTo(DataSource.GTFS_REALTIME);
            assertThat(t.stale()).isFalse();
        });
        assertThat(MetroStateResponse.from(state).isLive()).isTrue();
    }

    @Test
    void aFrozenFeedDegradesToEstimatedPositionsAndThenExpires() {
        gtfs.snapshot = new ProviderSnapshot(List.of(atB("v1", T0)), List.of(), List.of(), T0, List.of());
        MetroStateManager manager = manager(RealtimeMode.AUTO);
        manager.pollOnce(DataSource.GTFS_REALTIME);

        // The feed keeps answering, but its own header timestamp never advances.
        clock.advance(Duration.ofSeconds(120));
        manager.pollOnce(DataSource.GTFS_REALTIME);
        MetroState state = manager.publishNow();

        assertThat(health(state, DataSource.GTFS_REALTIME).status()).isEqualTo(ProviderStatus.STALE);
        // Still the real (last seen) trains — not swapped for simulated ones — but labelled estimates.
        assertThat(state.activeSource()).isEqualTo(DataSource.GTFS_REALTIME);
        assertThat(state.activeSourceStale()).isTrue();
        assertThat(state.sourceReason()).contains("stale").contains("estimated");
        assertThat(MetroStateResponse.from(state).isLive()).isFalse();
        // Last seen at B outbound; 30 s dwell + 60 s to C, so after 120 s it is estimated at C.
        assertThat(state.trains()).singleElement().satisfies(t -> {
            assertThat(t.stale()).isTrue();
            assertThat(t.positionEstimated()).isTrue();
            assertThat(t.previousStationId()).isEqualTo(3);
            assertThat(t.nextStationId()).isEqualTo(3);
            assertThat(t.speedKmph()).isNull();
        });

        // Past expiry the observations are dropped and AUTO falls through to what remains.
        clock.advance(Duration.ofMinutes(5));
        manager.pollOnce(DataSource.GTFS_REALTIME);
        MetroState expired = manager.publishNow();
        assertThat(health(expired, DataSource.GTFS_REALTIME).status()).isEqualTo(ProviderStatus.ERROR);
        assertThat(expired.activeSource()).isEqualTo(DataSource.SIMULATION);
    }

    @Test
    void aPinnedFeedThatFailsIsReportedStaleRatherThanSilentlyReplaced() {
        gtfs.snapshot = new ProviderSnapshot(List.of(atB("v1", T0)), List.of(), List.of(), T0, List.of());
        MetroStateManager manager = manager(RealtimeMode.GTFS_REALTIME);
        manager.pollOnce(DataSource.GTFS_REALTIME);

        gtfs.failure = new ProviderException("HTTP 503 from https://feed.example/vp");
        clock.advance(Duration.ofSeconds(100));
        manager.pollOnce(DataSource.GTFS_REALTIME);
        MetroState state = manager.publishNow();

        assertThat(state.activeSource()).isEqualTo(DataSource.GTFS_REALTIME);
        assertThat(state.activeSourceStale()).isTrue();
        assertThat(state.trains()).singleElement().satisfies(t -> assertThat(t.stale()).isTrue());
        assertThat(state.sourceReason()).contains("HTTP 503");
        assertThat(MetroStateResponse.from(state).isLive()).isFalse();
    }

    @Test
    void failuresBackOffExponentiallyAndRecoveryResetsTheCount() {
        gtfs.failure = new ProviderException("timeout");
        MetroStateManager manager = manager(RealtimeMode.AUTO);

        Duration first = manager.pollOnce(DataSource.GTFS_REALTIME);
        Duration second = manager.pollOnce(DataSource.GTFS_REALTIME);
        Duration third = manager.pollOnce(DataSource.GTFS_REALTIME);
        // 15s base, x1/x2/x4, each with +-20% jitter.
        assertThat(first).isBetween(Duration.ofSeconds(12), Duration.ofSeconds(18));
        assertThat(second).isBetween(Duration.ofSeconds(24), Duration.ofSeconds(36));
        assertThat(third).isBetween(Duration.ofSeconds(48), Duration.ofSeconds(72));
        assertThat(health(manager.publishNow(), DataSource.GTFS_REALTIME).consecutiveFailures()).isEqualTo(3);
        assertThat(health(manager.current(), DataSource.GTFS_REALTIME).status()).isEqualTo(ProviderStatus.ERROR);

        gtfs.failure = null;
        gtfs.snapshot = new ProviderSnapshot(List.of(atB("v1", T0)), List.of(), List.of(), T0, List.of());
        assertThat(manager.pollOnce(DataSource.GTFS_REALTIME)).isEqualTo(Duration.ofSeconds(15));
        ProviderHealth recovered = health(manager.publishNow(), DataSource.GTFS_REALTIME);
        assertThat(recovered.consecutiveFailures()).isZero();
        assertThat(recovered.status()).isEqualTo(ProviderStatus.HEALTHY);
    }

    @Test
    void trainIdsAreStableAcrossFetchesAndVersionsIncrease() {
        gtfs.snapshot = new ProviderSnapshot(List.of(atB("v1", T0), atB("v2", T0)), List.of(), List.of(), T0, List.of());
        MetroStateManager manager = manager(RealtimeMode.AUTO);
        manager.pollOnce(DataSource.GTFS_REALTIME);
        MetroState first = manager.publishNow();

        clock.advance(Duration.ofSeconds(15));
        Instant later = clock.instant();
        gtfs.snapshot = new ProviderSnapshot(List.of(atB("v2", later), atB("v1", later)), List.of(), List.of(), later, List.of());
        manager.pollOnce(DataSource.GTFS_REALTIME);
        MetroState second = manager.publishNow();

        assertThat(second.version()).isGreaterThan(first.version());
        assertThat(second.instanceId()).isEqualTo(first.instanceId());
        Map<String, Long> firstIds = idsByVehicle(first);
        assertThat(idsByVehicle(second)).isEqualTo(firstIds);
        assertThat(firstIds.values()).doesNotHaveDuplicates();
    }

    @Test
    void aPinnedSourceWithNoDataNeverBorrowsSimulatedTrains() {
        gtfs.configured = false;
        MetroStateManager manager = manager(RealtimeMode.LIVE);

        MetroState state = manager.publishNow();

        assertThat(state.activeSource()).isEqualTo(DataSource.LIVE);
        assertThat(state.trains()).isEmpty();
        assertThat(state.simulation()).isNull();
        assertThat(state.sourceReason()).contains("unconfigured");
    }

    private static Map<String, Long> idsByVehicle(MetroState state) {
        Map<String, Long> ids = new java.util.HashMap<>();
        state.trains().forEach(t -> ids.put(t.vehicleId(), t.id()));
        return ids;
    }

    private static ProviderHealth health(MetroState state, DataSource source) {
        return state.providers().stream().filter(h -> h.source() == source).findFirst().orElseThrow();
    }

    /** A remote provider whose next answer the test sets directly. */
    private static final class FakeFeed implements MetroRealtimeProvider {
        private final DataSource source;
        boolean configured;
        ProviderSnapshot snapshot = new ProviderSnapshot(List.of(), List.of(), List.of(), null, List.of());
        ProviderException failure;

        FakeFeed(DataSource source, boolean configured) {
            this.source = source;
            this.configured = configured;
        }

        @Override
        public DataSource source() {
            return source;
        }

        @Override
        public String name() {
            return "fake " + source;
        }

        @Override
        public boolean isConfigured() {
            return configured;
        }

        @Override
        public FeedMapping mapping() {
            return FeedMapping.internal();
        }

        @Override
        public ProviderSnapshot fetchSnapshot(Instant now) throws ProviderException {
            if (failure != null) {
                throw failure;
            }
            return snapshot;
        }

        @Override
        public List<VehiclePosition> getVehiclePositions(Instant now) throws ProviderException {
            return fetchSnapshot(now).vehiclePositions();
        }

        @Override
        public List<TripUpdate> getTripUpdates(Instant now) throws ProviderException {
            return fetchSnapshot(now).tripUpdates();
        }

        @Override
        public List<ServiceAlert> getServiceAlerts(Instant now) throws ProviderException {
            return fetchSnapshot(now).serviceAlerts();
        }
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("Asia/Kolkata");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
