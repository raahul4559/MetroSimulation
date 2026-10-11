package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Carries an observed train forward between provider fetches, along the track graph. Pure.
 *
 * <p><b>Fresh</b> (observed within {@code staleAfter}): a {@code RUNNING} train on a known leg is
 * advanced along that leg only — by the provider's ETA when it gave one, else at the leg's nominal
 * running time — and never past {@link #MAX_EXTRAPOLATED_PROGRESS}: arriving is something only the
 * feed may report. This is what lets a feed that updates every 15–30 s still publish every second.
 *
 * <p><b>Stale</b> (older than {@code staleAfter}, not yet expired): the feed has stopped placing
 * this train, so showing it frozen would be a claim that it is standing still. Instead it is
 * dead-reckoned along its own route from its last fix, using the network's nominal leg times and
 * dwell times — the same numbers the timetable estimate uses — through intermediate stations, and
 * held at the terminus. The result is flagged {@code stale} and {@code positionEstimated}, its speed
 * and ETA are cleared (an estimate has neither), and the frontend labels it an estimate.
 */
public final class TrainExtrapolator {

    static final double MAX_EXTRAPOLATED_PROGRESS = 0.97;

    private TrainExtrapolator() {
    }

    public static MetroTrain at(MetroTrain observed, Instant now, MetroNetwork network, RealtimeSettings settings) {
        Duration age = Duration.between(observed.observedAt(), now);
        boolean stale = age.compareTo(settings.staleAfter()) > 0;
        MetroTrain train = observed.withStale(stale);
        if (age.isNegative() || age.isZero()) {
            return train;
        }
        double elapsed = age.toMillis() / 1000.0;
        return stale ? alongRoute(train, elapsed, network) : withinLeg(train, elapsed, network);
    }

    private static MetroTrain withinLeg(MetroTrain observed, double elapsed, MetroNetwork network) {
        if (observed.status() != TrainStatus.RUNNING || observed.currentTrackId() == null
                || observed.progress() >= MAX_EXTRAPOLATED_PROGRESS) {
            return observed;
        }
        Optional<Track> track = track(network, observed.currentTrackId());
        if (track.isEmpty() || track.get().expectedTravelTimeSeconds() <= 0) {
            return observed;
        }

        double progress;
        Instant eta = observed.nextStationEta();
        if (eta != null && eta.isAfter(observed.observedAt())) {
            // Close the remaining distance linearly by the provider's own predicted arrival.
            double window = Duration.between(observed.observedAt(), eta).toMillis() / 1000.0;
            progress = observed.progress() + (1 - observed.progress()) * Math.min(1, elapsed / window);
        } else {
            progress = observed.progress() + elapsed / track.get().expectedTravelTimeSeconds();
        }
        return observed.withProgress(Math.min(progress, MAX_EXTRAPOLATED_PROGRESS), true);
    }

    /** Walks the train's route from its last fix for {@code elapsed} seconds of nominal running. */
    static MetroTrain alongRoute(MetroTrain observed, double elapsed, MetroNetwork network) {
        Optional<Line> line = network.findLineByCode(observed.lineCode());
        if (line.isEmpty()) {
            return observed;
        }
        List<Station> route = new ArrayList<>(line.get().orderedStations());
        if (observed.direction() == TrainDirection.INBOUND) {
            Collections.reverse(route);
        }
        int at = indexOf(route, observed.previousStationId());
        if (at < 0) {
            return observed;
        }

        double remaining = elapsed;
        double progress;
        if (observed.previousStationId() == observed.nextStationId()) {
            // At a platform: assume the dwell began at the last fix (the conservative choice).
            remaining -= Math.max(0, route.get(at).dwellTimeSeconds());
            if (remaining < 0) {
                return stationary(observed, route.get(at));
            }
            progress = 0;
        } else {
            if (at + 1 >= route.size() || route.get(at + 1).id() != observed.nextStationId()) {
                return observed; // a leg that isn't on this line in this direction — don't guess
            }
            progress = observed.progress();
        }

        while (at + 1 < route.size()) {
            Station from = route.get(at);
            Station to = route.get(at + 1);
            Optional<Track> leg = network.getSingleTrackBetween(from.id(), to.id());
            if (leg.isEmpty()) {
                return observed;
            }
            int legSeconds = Math.max(1, leg.get().expectedTravelTimeSeconds());
            double legRemaining = (1 - progress) * legSeconds;
            if (remaining < legRemaining) {
                double estimated = progress + remaining / legSeconds;
                return observed.withPosition(leg.get().id(), from.id(), to.id(), estimated, TrainStatus.RUNNING,
                        null, null, true);
            }
            remaining -= legRemaining;
            at++;
            progress = 0;
            if (at + 1 >= route.size()) {
                break; // reached the terminus
            }
            remaining -= Math.max(0, to.dwellTimeSeconds());
            if (remaining < 0) {
                return stationary(observed, to);
            }
        }
        return stationary(observed, route.get(route.size() - 1));
    }

    private static MetroTrain stationary(MetroTrain observed, Station station) {
        return observed.withPosition(null, station.id(), station.id(), 0, TrainStatus.DWELLING, null, null, true);
    }

    private static int indexOf(List<Station> route, long stationId) {
        for (int i = 0; i < route.size(); i++) {
            if (route.get(i).id() == stationId) {
                return i;
            }
        }
        return -1;
    }

    private static Optional<Track> track(MetroNetwork network, long trackId) {
        return network.allTracks().stream().filter(t -> t.id() == trackId).findFirst();
    }
}
