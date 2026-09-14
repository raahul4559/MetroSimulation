package com.nammametro.simulation.metro.network;

import com.nammametro.simulation.metro.domain.model.Interchange;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * The metro network as an in-memory graph — stations are nodes, tracks are edges. Built once at
 * startup from {@code MetroNetworkAssembler} and treated as read-only afterward; not safe for
 * concurrent mutation.
 *
 * <p>Deliberately plain Java — no Spring, no persistence framework — so it and the routing layer
 * built on top of it can be unit-tested and reasoned about without a database or a running
 * application context.
 */
public class MetroNetwork {

    private final List<Station> stations = new ArrayList<>();
    private final List<Line> lines = new ArrayList<>();
    private final List<Track> tracks = new ArrayList<>();

    private final Map<Long, Station> stationsById = new LinkedHashMap<>();
    private final Map<Long, Line> linesById = new LinkedHashMap<>();
    private final Map<Long, List<Track>> adjacency = new HashMap<>();

    public void addStation(Station station) {
        stations.add(station);
        stationsById.putIfAbsent(station.id(), station);
    }

    public void addLine(Line line) {
        lines.add(line);
        linesById.putIfAbsent(line.id(), line);
    }

    public void addTrack(Track track) {
        tracks.add(track);
        if (stationsById.containsKey(track.fromStationId()) && stationsById.containsKey(track.toStationId())) {
            adjacency.computeIfAbsent(track.fromStationId(), id -> new ArrayList<>()).add(track);
            adjacency.computeIfAbsent(track.toStationId(), id -> new ArrayList<>()).add(track);
        }
    }

    public Optional<Station> findStation(long id) {
        return Optional.ofNullable(stationsById.get(id));
    }

    public Optional<Station> findStationByCode(String code) {
        return stations.stream().filter(s -> s.code().equals(code)).findFirst();
    }

    public Optional<Line> findLine(long id) {
        return Optional.ofNullable(linesById.get(id));
    }

    public Optional<Line> findLineByCode(String code) {
        return lines.stream().filter(l -> l.code().equals(code)).findFirst();
    }

    /** Stations directly reachable from {@code stationId} by a single track. */
    public List<Station> findNeighbors(long stationId) {
        return tracksIncidentTo(stationId).stream()
                .map(track -> track.otherEndpoint(stationId))
                .map(stationsById::get)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    public List<Station> getStationsForLine(long lineId) {
        return findLine(lineId).map(Line::orderedStations).orElseGet(List::of);
    }

    public List<Track> getTracksBetween(long stationIdA, long stationIdB) {
        return tracks.stream()
                .filter(t -> (t.fromStationId() == stationIdA && t.toStationId() == stationIdB)
                        || (t.fromStationId() == stationIdB && t.toStationId() == stationIdA))
                .toList();
    }

    public List<Track> tracksIncidentTo(long stationId) {
        return adjacency.getOrDefault(stationId, List.of());
    }

    public List<Station> allStations() {
        return List.copyOf(stationsById.values());
    }

    public List<Line> allLines() {
        return List.copyOf(linesById.values());
    }

    public List<Track> allTracks() {
        return List.copyOf(tracks);
    }

    public List<Interchange> getInterchanges() {
        return stationsById.values().stream()
                .filter(station -> station.lineCodes().size() > 1)
                .map(station -> new Interchange(
                        station,
                        station.lineCodes().stream()
                                .map(this::findLineByCode)
                                .flatMap(Optional::stream)
                                .toList()))
                .toList();
    }

    /** The single track connecting two adjacent stations, if any — validated to be at most one. */
    public Optional<Track> getSingleTrackBetween(long stationIdA, long stationIdB) {
        return getTracksBetween(stationIdA, stationIdB).stream().findFirst();
    }

    /**
     * Checks, over the raw (pre-dedup) data actually added: duplicate station IDs, tracks/lines
     * referencing unknown stations, zero/negative-length or self-looping tracks, duplicate tracks
     * between the same pair, lines with fewer than two stations, and missing/implausible
     * coordinates. Errors mean the graph should not be trusted for routing; warnings are advisory.
     */
    public NetworkValidationResult validate() {
        List<ValidationIssue> issues = new ArrayList<>();

        checkDuplicateStationIds(issues);
        checkStationCoordinates(issues);
        checkLineReferences(issues);
        checkTrackReferencesAndShape(issues);
        checkDuplicateTracks(issues);

        return new NetworkValidationResult(issues);
    }

    private void checkDuplicateStationIds(List<ValidationIssue> issues) {
        Map<Long, Long> countsById = stations.stream()
                .collect(Collectors.groupingBy(Station::id, Collectors.counting()));
        countsById.forEach((id, count) -> {
            if (count > 1) {
                issues.add(ValidationIssue.error("DUPLICATE_STATION_ID",
                        "Station id %d appears %d times".formatted(id, count)));
            }
        });
    }

    private void checkStationCoordinates(List<ValidationIssue> issues) {
        for (Station station : stations) {
            double lat = station.coordinates().latitude();
            double lng = station.coordinates().longitude();
            if (lat == 0.0 && lng == 0.0) {
                issues.add(ValidationIssue.error("MISSING_COORDINATES",
                        "Station %s (%d) has no coordinates set".formatted(station.code(), station.id())));
            } else if (lat < 12.7 || lat > 13.3 || lng < 77.3 || lng > 77.9) {
                issues.add(ValidationIssue.warning("IMPLAUSIBLE_COORDINATES",
                        "Station %s (%d) coordinates (%.4f, %.4f) fall outside the expected Bangalore bounding box"
                                .formatted(station.code(), station.id(), lat, lng)));
            }
        }
    }

    private void checkLineReferences(List<ValidationIssue> issues) {
        for (Line line : lines) {
            if (line.orderedStations().size() < 2) {
                issues.add(ValidationIssue.error("INVALID_LINE_ORDERING",
                        "Line %s (%d) has fewer than 2 stations".formatted(line.code(), line.id())));
                continue;
            }
            Map<Long, Long> countsInLine = line.orderedStations().stream()
                    .collect(Collectors.groupingBy(Station::id, Collectors.counting()));
            countsInLine.forEach((stationId, count) -> {
                if (count > 1) {
                    issues.add(ValidationIssue.error("INVALID_LINE_ORDERING",
                            "Line %s (%d) lists station id %d more than once"
                                    .formatted(line.code(), line.id(), stationId)));
                }
            });
        }
    }

    private void checkTrackReferencesAndShape(List<ValidationIssue> issues) {
        for (Track track : tracks) {
            boolean fromExists = stationsById.containsKey(track.fromStationId());
            boolean toExists = stationsById.containsKey(track.toStationId());
            if (!fromExists || !toExists) {
                issues.add(ValidationIssue.error("INVALID_STATION_REFERENCE",
                        "Track %d references a non-existent station (from=%d, to=%d)"
                                .formatted(track.id(), track.fromStationId(), track.toStationId())));
                continue;
            }
            if (track.fromStationId() == track.toStationId()) {
                issues.add(ValidationIssue.error("BROKEN_TRACK",
                        "Track %d connects station %d to itself".formatted(track.id(), track.fromStationId())));
            }
            if (track.distanceMetres() <= 0 || track.expectedTravelTimeSeconds() <= 0) {
                issues.add(ValidationIssue.error("BROKEN_TRACK",
                        "Track %d has a non-positive distance or travel time".formatted(track.id())));
            }
        }
    }

    private void checkDuplicateTracks(List<ValidationIssue> issues) {
        Map<String, Long> countsByPair = tracks.stream()
                .collect(Collectors.groupingBy(this::unorderedPairKey, Collectors.counting()));
        countsByPair.forEach((pairKey, count) -> {
            if (count > 1) {
                issues.add(ValidationIssue.error("DUPLICATE_TRACK",
                        "More than one track connects station pair %s (%d occurrences)".formatted(pairKey, count)));
            }
        });
    }

    private String unorderedPairKey(Track track) {
        long a = Math.min(track.fromStationId(), track.toStationId());
        long b = Math.max(track.fromStationId(), track.toStationId());
        return a + ":" + b;
    }
}
