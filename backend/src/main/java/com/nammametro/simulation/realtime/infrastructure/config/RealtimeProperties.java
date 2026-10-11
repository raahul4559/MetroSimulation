package com.nammametro.simulation.realtime.infrastructure.config;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.realtime.domain.RealtimeMode;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Backs the {@code realtime.*} keys in application.yml. Every external endpoint is configuration —
 * none is compiled in — and every one defaults to empty, which leaves that provider
 * {@code UNCONFIGURED} rather than pointed at a guess. See {@code docs/realtime.md}.
 */
@ConfigurationProperties(prefix = "realtime")
public record RealtimeProperties(
        @DefaultValue("AUTO") RealtimeMode mode,
        @DefaultValue("90s") Duration staleAfter,
        @DefaultValue("5m") Duration expireAfter,
        @DefaultValue("30s") Duration maxClockSkew,
        @DefaultValue("1500") double maxSnapDistanceMetres,
        @DefaultValue("5m") Duration maxBackoff,
        @DefaultValue Official official,
        @DefaultValue Gtfs gtfs,
        @DefaultValue Timetable timetable
) {

    /** An authorized operator feed speaking the JSON contract in {@code docs/realtime.md}. */
    public record Official(
            @DefaultValue("") String url,
            @DefaultValue("Authorization") String authHeaderName,
            @DefaultValue("") String authHeaderValue,
            @DefaultValue("15s") Duration pollInterval,
            @DefaultValue("10s") Duration requestTimeout,
            @DefaultValue Mapping mapping
    ) {
    }

    /** A GTFS-Realtime feed. Endpoints may be the same URL (one combined feed) or three. */
    public record Gtfs(
            @DefaultValue("") String vehiclePositionsUrl,
            @DefaultValue("") String tripUpdatesUrl,
            @DefaultValue("") String alertsUrl,
            @DefaultValue("") String authHeaderName,
            @DefaultValue("") String authHeaderValue,
            @DefaultValue("15s") Duration pollInterval,
            @DefaultValue("10s") Duration requestTimeout,
            @DefaultValue Mapping mapping
    ) {
    }

    public record Mapping(
            Map<String, String> stopIds,
            Map<String, String> routeIds,
            Map<Integer, TrainDirection> directionIds
    ) {
    }

    /**
     * Operating hours, per line and day type. Empty by default on purpose — fill it from a published
     * BMRCL notice and cite it in {@code source}.
     */
    public record Timetable(
            @DefaultValue("") String source,
            @DefaultValue("03:00") String serviceDayRollover,
            List<LocalDate> holidays,
            Map<String, LineDays> lines
    ) {
    }

    public record LineDays(List<Period> weekday, List<Period> saturday, List<Period> sunday) {
    }

    /** {@code from}/{@code to} are IST "HH:mm" (hours past 24 allowed for after-midnight service). */
    public record Period(String from, String to, int headwaySeconds) {
    }
}
