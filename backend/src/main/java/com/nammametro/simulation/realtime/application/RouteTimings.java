package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Nominal stop-by-stop timings for one run of a line in one direction, from the network's own
 * {@code Track#expectedTravelTimeSeconds} and {@code Station#dwellTimeSeconds} — the same numbers
 * the simulation engine and the frontend's ETA already use, so a timetable estimate and a
 * simulated train agree on how long a leg takes.
 *
 * <p>Offsets are seconds after the run leaves its origin. The origin's arrival and departure are
 * both 0; the terminus's departure is its arrival plus its dwell, which is how long the train is
 * shown standing there before the run ends.
 */
public record RouteTimings(String lineCode, TrainDirection direction, List<Stop> stops, List<Track> legs) {

    public record Stop(Station station, int arrivalOffset, int departureOffset) {
    }

    public static RouteTimings of(MetroNetwork network, Line line, TrainDirection direction) {
        List<Station> ordered = new ArrayList<>(line.orderedStations());
        if (direction == TrainDirection.INBOUND) {
            Collections.reverse(ordered);
        }

        List<Stop> stops = new ArrayList<>(ordered.size());
        List<Track> legs = new ArrayList<>(Math.max(0, ordered.size() - 1));
        int clock = 0;
        for (int i = 0; i < ordered.size(); i++) {
            Station station = ordered.get(i);
            if (i == 0) {
                stops.add(new Stop(station, 0, 0));
                continue;
            }
            Station previous = ordered.get(i - 1);
            Track leg = network.getSingleTrackBetween(previous.id(), station.id())
                    .orElseThrow(() -> new IllegalStateException(
                            "No track between %s and %s on %s".formatted(previous.code(), station.code(), line.code())));
            legs.add(leg);
            int arrival = clock + leg.expectedTravelTimeSeconds();
            int departure = arrival + Math.max(0, station.dwellTimeSeconds());
            stops.add(new Stop(station, arrival, departure));
            clock = departure;
        }
        return new RouteTimings(line.code(), direction, List.copyOf(stops), List.copyOf(legs));
    }

    /** Seconds from leaving the origin to the run ending at the terminus (after its dwell). */
    public int totalSeconds() {
        return stops.isEmpty() ? 0 : stops.getLast().departureOffset();
    }
}
