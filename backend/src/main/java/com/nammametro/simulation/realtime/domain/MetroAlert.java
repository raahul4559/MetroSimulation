package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.util.List;

/**
 * A {@link ServiceAlert} resolved onto the network: provider route/stop ids mapped to this
 * network's line codes and station ids. Identifiers that couldn't be mapped are dropped from the
 * lists, but the alert itself is kept — an alert about a station this network doesn't model is
 * still a real alert, and its text is still shown.
 */
public record MetroAlert(
        String id,
        DataSource source,
        String cause,
        String effect,
        ServiceAlert.AlertSeverity severity,
        String headerText,
        String descriptionText,
        Instant activeFrom,
        Instant activeUntil,
        List<String> lineCodes,
        List<Long> stationIds
) {

    public MetroAlert {
        lineCodes = List.copyOf(lineCodes);
        stationIds = List.copyOf(stationIds);
    }

    /** GTFS-Realtime's {@code NO_SERVICE} effect — the line (or station) isn't running at all. */
    public boolean suspendsService() {
        return "NO_SERVICE".equalsIgnoreCase(effect);
    }
}
