package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Carries an observed train forward between provider fetches, so a feed that updates every 15–30
 * seconds still moves smoothly on a 1-second publish. Pure.
 *
 * <p>Deliberately conservative: only a {@code RUNNING} train on a known leg is advanced; it is
 * never advanced past {@link #MAX_EXTRAPOLATED_PROGRESS} (arrival is something only the feed may
 * report); and a stale train is not advanced at all — it stays where it was last seen, flagged
 * stale, until it either reappears or expires. Anything advanced is flagged
 * {@code positionEstimated}.
 */
public final class TrainExtrapolator {

    static final double MAX_EXTRAPOLATED_PROGRESS = 0.97;

    private TrainExtrapolator() {
    }

    public static MetroTrain at(MetroTrain observed, Instant now, MetroNetwork network, RealtimeSettings settings) {
        Duration age = Duration.between(observed.observedAt(), now);
        boolean stale = age.compareTo(settings.staleAfter()) > 0;
        MetroTrain train = observed.withStale(stale);
        if (stale || age.isNegative() || age.isZero() || observed.status() != TrainStatus.RUNNING
                || observed.currentTrackId() == null || observed.progress() >= MAX_EXTRAPOLATED_PROGRESS) {
            return train;
        }

        Optional<Track> track = network.allTracks().stream()
                .filter(t -> t.id() == observed.currentTrackId())
                .findFirst();
        if (track.isEmpty() || track.get().expectedTravelTimeSeconds() <= 0) {
            return train;
        }

        double elapsed = age.toMillis() / 1000.0;
        double progress;
        Instant eta = observed.nextStationEta();
        if (eta != null && eta.isAfter(observed.observedAt())) {
            // Close the remaining distance linearly by the provider's own predicted arrival.
            double window = Duration.between(observed.observedAt(), eta).toMillis() / 1000.0;
            progress = observed.progress() + (1 - observed.progress()) * Math.min(1, elapsed / window);
        } else {
            progress = observed.progress() + elapsed / track.get().expectedTravelTimeSeconds();
        }
        progress = Math.min(progress, MAX_EXTRAPOLATED_PROGRESS);
        return train.withProgress(progress, true);
    }
}
