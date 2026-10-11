package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.util.List;

/**
 * A service alert as published by a provider — shaped after GTFS-Realtime's {@code Alert}.
 * {@code routeIds}/{@code stopIds} are the provider's own identifiers; {@code FeedNormalizer}
 * resolves them to line codes/station ids. A null {@code activeFrom}/{@code activeUntil} means the
 * period is open on that side.
 */
public record ServiceAlert(
        String id,
        String cause,
        String effect,
        AlertSeverity severity,
        String headerText,
        String descriptionText,
        Instant activeFrom,
        Instant activeUntil,
        List<String> routeIds,
        List<String> stopIds
) {

    public ServiceAlert {
        routeIds = routeIds == null ? List.of() : List.copyOf(routeIds);
        stopIds = stopIds == null ? List.of() : List.copyOf(stopIds);
        severity = severity == null ? AlertSeverity.UNKNOWN : severity;
    }

    public boolean isActiveAt(Instant now) {
        return (activeFrom == null || !now.isBefore(activeFrom)) && (activeUntil == null || now.isBefore(activeUntil));
    }

    public enum AlertSeverity {
        UNKNOWN,
        INFO,
        WARNING,
        SEVERE
    }
}
