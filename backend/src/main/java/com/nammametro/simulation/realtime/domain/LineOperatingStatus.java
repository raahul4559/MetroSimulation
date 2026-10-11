package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.util.List;

/**
 * One line's service status right now, and why. {@code basis} names the evidence:
 * {@code TIMETABLE} (configured hours), {@code EXCEPTION} (a date-specific schedule exception),
 * {@code ALERT} (a realtime service alert), {@code REALTIME} (trains observed running) or
 * {@code NONE} (nothing known — {@link ServiceState#UNKNOWN}).
 *
 * <p>{@code firstDeparture}/{@code lastDeparture} are IST "HH:mm" for the current service day
 * (GTFS-style, hours past 24 for after-midnight trains) with their exact instants alongside;
 * {@code nextServiceAt} is the next timetabled first departure after now — today's if service hasn't
 * started, else a later service day's. All are null when the timetable doesn't say: no time is
 * ever filled in from a guess.
 */
public record LineOperatingStatus(
        String lineCode,
        ServiceState state,
        String basis,
        String reason,
        String firstDeparture,
        String lastDeparture,
        Instant firstDepartureAt,
        Instant lastDepartureAt,
        Instant nextServiceAt,
        int trainsReported,
        List<String> alertIds
) {

    public LineOperatingStatus {
        alertIds = alertIds == null ? List.of() : List.copyOf(alertIds);
    }

    public LineOperatingStatus with(ServiceState newState, String newBasis, String newReason, int newTrainsReported,
                                    List<String> newAlertIds) {
        return new LineOperatingStatus(lineCode, newState, newBasis, newReason, firstDeparture, lastDeparture,
                firstDepartureAt, lastDepartureAt, nextServiceAt, newTrainsReported, newAlertIds);
    }
}
