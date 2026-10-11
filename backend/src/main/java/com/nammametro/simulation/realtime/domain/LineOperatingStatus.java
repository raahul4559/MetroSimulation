package com.nammametro.simulation.realtime.domain;

/**
 * Whether a line should be running right now and why. {@code basis} is honest about where the
 * answer came from: {@code TIMETABLE} (configured operating hours) or {@code ALERT} (a realtime
 * provider's service alert overrides the timetable). {@code UNKNOWN} with no timetable configured is
 * the correct answer, not an error — this code does not guess BMRCL's hours.
 *
 * <p>{@code firstDeparture}/{@code lastDeparture} are IST wall-clock times ("HH:mm", GTFS-style hours
 * past 24 allowed for after-midnight trains) for today's service day, or null when unknown.
 */
public record LineOperatingStatus(
        String lineCode,
        OperatingState state,
        String basis,
        String reason,
        String firstDeparture,
        String lastDeparture,
        int trainsReported
) {

    public enum OperatingState {
        OPERATING,
        NOT_OPERATING,
        SUSPENDED,
        UNKNOWN
    }
}
