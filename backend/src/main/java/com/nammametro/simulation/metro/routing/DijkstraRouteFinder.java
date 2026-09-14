package com.nammametro.simulation.metro.routing;

import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.metro.domain.exception.RouteNotFoundException;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/**
 * Stateless shortest-path routing over a {@link MetroNetwork}, weighted by expected travel time
 * (the metric a rider actually cares about, not raw distance). Pure Java — no Spring — so it can be
 * exercised directly in a unit test against a hand-built network.
 */
public final class DijkstraRouteFinder {

    private DijkstraRouteFinder() {
    }

    public static Route findRoute(MetroNetwork network, long fromStationId, long toStationId) {
        Station from = network.findStation(fromStationId)
                .orElseThrow(() -> new ResourceNotFoundException("Station", String.valueOf(fromStationId)));
        Station to = network.findStation(toStationId)
                .orElseThrow(() -> new ResourceNotFoundException("Station", String.valueOf(toStationId)));

        if (from.id() == to.id()) {
            return new Route(List.of(from), List.of(), 0, 0);
        }

        Map<Long, Long> bestTime = new HashMap<>();
        Map<Long, Track> cameFromTrack = new HashMap<>();
        PriorityQueue<long[]> frontier = new PriorityQueue<>(Comparator.comparingLong(entry -> entry[1]));

        bestTime.put(from.id(), 0L);
        frontier.add(new long[] { from.id(), 0L });

        while (!frontier.isEmpty()) {
            long[] current = frontier.poll();
            long stationId = current[0];
            long time = current[1];

            if (time > bestTime.getOrDefault(stationId, Long.MAX_VALUE)) {
                continue; // superseded by a shorter path already processed
            }
            if (stationId == to.id()) {
                break;
            }

            for (Track track : network.tracksIncidentTo(stationId)) {
                long neighborId = track.otherEndpoint(stationId);
                long candidateTime = time + track.expectedTravelTimeSeconds();
                if (candidateTime < bestTime.getOrDefault(neighborId, Long.MAX_VALUE)) {
                    bestTime.put(neighborId, candidateTime);
                    cameFromTrack.put(neighborId, track);
                    frontier.add(new long[] { neighborId, candidateTime });
                }
            }
        }

        if (!bestTime.containsKey(to.id())) {
            throw new RouteNotFoundException(fromStationId, toStationId);
        }

        return reconstruct(network, from, to, cameFromTrack);
    }

    private static Route reconstruct(MetroNetwork network, Station from, Station to, Map<Long, Track> cameFromTrack) {
        LinkedList<Track> tracks = new LinkedList<>();
        LinkedList<Station> stations = new LinkedList<>();
        stations.addFirst(to);

        long currentId = to.id();
        while (currentId != from.id()) {
            Track track = cameFromTrack.get(currentId);
            tracks.addFirst(track);
            currentId = track.otherEndpoint(currentId);
            stations.addFirst(network.findStation(currentId).orElseThrow());
        }

        int totalDistance = tracks.stream().mapToInt(Track::distanceMetres).sum();
        int totalTime = tracks.stream().mapToInt(Track::expectedTravelTimeSeconds).sum();

        return new Route(List.copyOf(stations), List.copyOf(tracks), totalDistance, totalTime);
    }
}
