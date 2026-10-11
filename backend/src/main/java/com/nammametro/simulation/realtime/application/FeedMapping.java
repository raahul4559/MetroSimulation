package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.network.MetroNetwork;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Translates one provider's identifiers onto this network. Every feed names things its own way
 * (GTFS stop ids, an operator's internal codes), so each provider carries its own explicit
 * {@code stopIds}/{@code routeIds} maps. When an id isn't in the map, it falls back to matching this
 * network's own station/line code (case-insensitive) or numeric id — enough for the internal
 * providers, which speak the network's own codes, and harmless for external ones.
 *
 * <p>{@code directionIds} maps GTFS {@code direction_id} values onto {@link TrainDirection}. Their
 * meaning is feed-specific, so there is no default for external feeds: without a mapping, direction
 * is inferred from geometry or stop order instead.
 */
public record FeedMapping(
        Map<String, String> stopIds,
        Map<String, String> routeIds,
        Map<Integer, TrainDirection> directionIds
) {

    public FeedMapping {
        stopIds = stopIds == null ? Map.of() : Map.copyOf(stopIds);
        routeIds = routeIds == null ? Map.of() : Map.copyOf(routeIds);
        directionIds = directionIds == null ? Map.of() : Map.copyOf(directionIds);
    }

    public static FeedMapping identity() {
        return new FeedMapping(Map.of(), Map.of(), Map.of());
    }

    /** The internal convention ({@code ScheduleProvider}/{@code SimulationProvider}): network codes
     * as ids, {@code 0} = outbound, {@code 1} = inbound. */
    public static FeedMapping internal() {
        return new FeedMapping(Map.of(), Map.of(), Map.of(0, TrainDirection.OUTBOUND, 1, TrainDirection.INBOUND));
    }

    public Optional<Line> line(String routeId, MetroNetwork network) {
        if (routeId == null || routeId.isBlank()) {
            return Optional.empty();
        }
        String mapped = routeIds.getOrDefault(routeId, routeId);
        Optional<Line> byCode = network.findLineByCode(mapped.toUpperCase(Locale.ROOT));
        if (byCode.isPresent()) {
            return byCode;
        }
        return parseLong(mapped).flatMap(network::findLine);
    }

    public Optional<Station> station(String stopId, MetroNetwork network) {
        if (stopId == null || stopId.isBlank()) {
            return Optional.empty();
        }
        String mapped = stopIds.getOrDefault(stopId, stopId);
        Optional<Station> byCode = network.findStationByCode(mapped.toUpperCase(Locale.ROOT));
        if (byCode.isPresent()) {
            return byCode;
        }
        return parseLong(mapped).flatMap(network::findStation);
    }

    public Optional<TrainDirection> direction(Integer directionId) {
        return directionId == null ? Optional.empty() : Optional.ofNullable(directionIds.get(directionId));
    }

    private static Optional<Long> parseLong(String value) {
        try {
            return Optional.of(Long.parseLong(value.trim()));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }
}
