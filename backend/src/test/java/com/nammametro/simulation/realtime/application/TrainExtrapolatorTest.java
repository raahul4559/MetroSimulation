package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class TrainExtrapolatorTest {

    private static final Instant T0 = Instant.parse("2026-10-12T04:00:00Z");
    private final MetroNetwork network = RealtimeFixtures.network();
    private final RealtimeSettings settings = RealtimeSettings.defaults();

    /** A GTFS train observed at {@code T0} on the leg {@code prev -> next} (track ids 11 = A-B, 12 = B-C). */
    private static MetroTrain observed(TrainDirection direction, Long trackId, long prev, long next, double progress,
                                       TrainStatus status) {
        return new MetroTrain(1_000_000, "17", "PURPLE", direction, trackId, prev, next, progress, 60.0, status,
                null, null, 30, T0.plusSeconds(20), null, null, null, null, null, null, null, null, null,
                DataSource.GTFS_REALTIME, "v17", null, T0, false, false);
    }

    @Test
    void freshTrainsAdvanceWithinTheirLegButNeverClaimArrival() {
        MetroTrain train = observed(TrainDirection.OUTBOUND, 11L, 1, 2, 0.5, TrainStatus.RUNNING);

        MetroTrain later = TrainExtrapolator.at(train, T0.plusSeconds(10), network, settings);
        assertThat(later.progress()).isCloseTo(0.75, within(0.001)); // ETA in 20 s, half the gap closed
        assertThat(later.positionEstimated()).isTrue();
        assertThat(later.stale()).isFalse();

        MetroTrain muchLater = TrainExtrapolator.at(train, T0.plusSeconds(80), network, settings);
        assertThat(muchLater.progress()).isEqualTo(TrainExtrapolator.MAX_EXTRAPOLATED_PROGRESS);
        assertThat(muchLater.nextStationId()).isEqualTo(2);
    }

    @Test
    void staleTrainsAreDeadReckonedAlongTheirRouteThroughStations() {
        MetroTrain train = observed(TrainDirection.OUTBOUND, 11L, 1, 2, 0.5, TrainStatus.RUNNING);

        // 30 s to reach B, 30 s dwell, then 40 s of the 60 s leg B -> C.
        MetroTrain estimate = TrainExtrapolator.at(train, T0.plusSeconds(100), network, settings);

        assertThat(estimate.stale()).isTrue();
        assertThat(estimate.positionEstimated()).isTrue();
        assertThat(estimate.previousStationId()).isEqualTo(2);
        assertThat(estimate.nextStationId()).isEqualTo(3);
        assertThat(estimate.currentTrackId()).isEqualTo(12L);
        assertThat(estimate.progress()).isCloseTo(40.0 / 60, within(0.001));
        assertThat(estimate.status()).isEqualTo(TrainStatus.RUNNING);
        // An estimate has no measured speed and no predicted arrival.
        assertThat(estimate.speedKmph()).isNull();
        assertThat(estimate.nextStationEta()).isNull();
        // What was observed is kept, and so is when.
        assertThat(estimate.delaySeconds()).isEqualTo(30);
        assertThat(estimate.observedAt()).isEqualTo(T0);
    }

    @Test
    void inboundTrainsWalkTheLineBackwardsAndHoldAtTheTerminus() {
        // Last seen dwelling at C: 30 s dwell, 60 s to B (arrive 90 s), 30 s dwell, 60 s to A (arrive 180 s).
        MetroTrain train = observed(TrainDirection.INBOUND, null, 3, 3, 0.0, TrainStatus.DWELLING);

        MetroTrain dwellingAtB = TrainExtrapolator.at(train, T0.plusSeconds(100), network, settings);
        assertThat(dwellingAtB.previousStationId()).isEqualTo(2);
        assertThat(dwellingAtB.nextStationId()).isEqualTo(2);
        assertThat(dwellingAtB.status()).isEqualTo(TrainStatus.DWELLING);

        MetroTrain atTerminus = TrainExtrapolator.at(train, T0.plusSeconds(280), network, settings);
        assertThat(atTerminus.previousStationId()).isEqualTo(1);
        assertThat(atTerminus.nextStationId()).isEqualTo(1);
        assertThat(atTerminus.currentTrackId()).isNull();
    }
}
