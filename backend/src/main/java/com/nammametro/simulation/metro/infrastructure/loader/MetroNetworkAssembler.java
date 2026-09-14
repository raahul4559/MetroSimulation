package com.nammametro.simulation.metro.infrastructure.loader;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawLine;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawStation;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawTrack;
import com.nammametro.simulation.metro.network.MetroNetwork;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Converts the raw JSON dataset into a populated {@link MetroNetwork}, deriving station type and
 * line membership from {@code lines.json} rather than trusting redundant fields in the dataset.
 *
 * <p>Reference resolution (a line or track naming a station code that doesn't exist in
 * {@code stations.json}) is a structural parse failure and fails fast here with a specific message
 * — the object graph literally can't be built without it. Semantic issues that can exist in an
 * otherwise well-formed graph (duplicate IDs, self-loop tracks, degenerate lines, implausible
 * coordinates, duplicate track pairs) are instead checked post-hoc by {@link MetroNetwork#validate()}.
 */
public class MetroNetworkAssembler {

    public MetroNetwork assemble(RawMetroData data) {
        Map<String, RawStation> stationsByCode = indexStationsByCode(data.stations());
        Map<String, List<String>> lineCodesByStationCode = computeLineMembership(data.lines());
        Set<String> terminalCodes = computeTerminalCodes(data.lines());

        MetroNetwork network = new MetroNetwork();
        Map<String, Station> resolvedStationsByCode = new LinkedHashMap<>();

        for (RawStation raw : data.stations()) {
            List<String> lineCodes = lineCodesByStationCode.getOrDefault(raw.code(), List.of());
            StationType type = lineCodes.size() > 1
                    ? StationType.INTERCHANGE
                    : terminalCodes.contains(raw.code()) ? StationType.TERMINAL : StationType.REGULAR;

            Station station = new Station(
                    raw.id(), raw.code(), raw.name(),
                    new Coordinates(raw.latitude(), raw.longitude()),
                    List.copyOf(lineCodes), type, type.defaultDwellTimeSeconds());

            network.addStation(station);
            resolvedStationsByCode.put(raw.code(), station);
        }

        for (RawLine rawLine : data.lines()) {
            List<Station> orderedStations = new ArrayList<>();
            for (String stationCode : rawLine.stationCodes()) {
                orderedStations.add(requireStation(resolvedStationsByCode, stationCode,
                        "Line " + rawLine.code() + " references unknown station code " + stationCode));
            }
            network.addLine(new Line(rawLine.id(), rawLine.code(), rawLine.name(), rawLine.color(),
                    List.copyOf(orderedStations)));
        }

        for (RawTrack rawTrack : data.tracks()) {
            Station from = requireStation(resolvedStationsByCode, rawTrack.fromStationCode(),
                    "Track " + rawTrack.id() + " references unknown station code " + rawTrack.fromStationCode());
            Station to = requireStation(resolvedStationsByCode, rawTrack.toStationCode(),
                    "Track " + rawTrack.id() + " references unknown station code " + rawTrack.toStationCode());
            List<Coordinates> geometry = rawTrack.geometry() == null
                    ? List.of()
                    : rawTrack.geometry().stream().map(g -> new Coordinates(g.latitude(), g.longitude())).toList();

            network.addTrack(new Track(rawTrack.id(), rawTrack.lineCode(), from.id(), to.id(),
                    rawTrack.distanceMetres(), rawTrack.expectedTravelTimeSeconds(), geometry));
        }

        return network;
    }

    private Map<String, RawStation> indexStationsByCode(List<RawStation> stations) {
        Map<String, RawStation> byCode = new LinkedHashMap<>();
        for (RawStation station : stations) {
            RawStation existing = byCode.putIfAbsent(station.code(), station);
            if (existing != null) {
                throw new IllegalStateException("Duplicate station code in dataset: " + station.code());
            }
        }
        return byCode;
    }

    private Map<String, List<String>> computeLineMembership(List<RawLine> lines) {
        Map<String, List<String>> membership = new LinkedHashMap<>();
        Set<String> seenLineCodes = new HashSet<>();
        for (RawLine line : lines) {
            if (!seenLineCodes.add(line.code())) {
                throw new IllegalStateException("Duplicate line code in dataset: " + line.code());
            }
            for (String stationCode : line.stationCodes()) {
                membership.computeIfAbsent(stationCode, code -> new ArrayList<>()).add(line.code());
            }
        }
        return membership;
    }

    private Set<String> computeTerminalCodes(List<RawLine> lines) {
        Set<String> terminals = new HashSet<>();
        for (RawLine line : lines) {
            if (!line.stationCodes().isEmpty()) {
                terminals.add(line.stationCodes().get(0));
                terminals.add(line.stationCodes().get(line.stationCodes().size() - 1));
            }
        }
        return terminals;
    }

    private Station requireStation(Map<String, Station> byCode, String code, String errorMessage) {
        Station station = byCode.get(code);
        if (station == null) {
            throw new IllegalStateException(errorMessage);
        }
        return station;
    }
}
