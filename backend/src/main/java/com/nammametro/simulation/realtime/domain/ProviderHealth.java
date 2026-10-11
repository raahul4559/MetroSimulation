package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * What the state manager knows about one provider right now. Published with every state so the
 * frontend can explain *why* it is showing what it is showing (e.g. "GTFS-Realtime: error — HTTP
 * 503, retrying in 40s; showing schedule").
 *
 * <p>{@code acceptedVehicles}/{@code rejectedVehicles}/{@code rejectionReasons} are from the most
 * recent successful fetch's normalization — vehicles a feed reported but this network couldn't
 * place are counted, never silently dropped.
 */
public record ProviderHealth(
        DataSource source,
        String name,
        ProviderStatus status,
        String detail,
        Instant lastAttemptAt,
        Instant lastSuccessAt,
        Instant feedTimestamp,
        Instant nextAttemptAt,
        int consecutiveFailures,
        int acceptedVehicles,
        int rejectedVehicles,
        Map<String, Integer> rejectionReasons,
        List<String> warnings
) {

    public ProviderHealth {
        rejectionReasons = rejectionReasons == null ? Map.of() : Map.copyOf(rejectionReasons);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }

    public static ProviderHealth of(DataSource source, String name, ProviderStatus status, String detail) {
        return new ProviderHealth(source, name, status, detail, null, null, null, null, 0, 0, 0, Map.of(), List.of());
    }

    public boolean isUsable() {
        return status == ProviderStatus.HEALTHY;
    }

    public enum ProviderStatus {
        /** Not configured (no URL/credentials, or no timetable) — never polled. */
        UNCONFIGURED,
        /** Configured, first fetch not finished yet. */
        CONNECTING,
        /** Fresh data within the staleness threshold. */
        HEALTHY,
        /** Data exists but is older than the staleness threshold (feed frozen or fetches failing). */
        STALE,
        /** Fetching/parsing failed and there is no usable data. */
        ERROR
    }
}
