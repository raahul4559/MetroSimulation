package com.nammametro.simulation.realtime.domain;

/**
 * Whether Namma Metro is running, per line and network-wide — decided by {@code ServiceStatusEngine}
 * from the configured timetable (in IST), its date exceptions, realtime service alerts, and trains
 * actually observed running.
 */
public enum ServiceState {
    /** Within timetabled hours (or trains observed running), with no disrupting alert. */
    OPERATING,
    /** The service day's first train hasn't left yet. */
    NOT_STARTED,
    /** The service day's last train has finished its run. */
    ENDED,
    /** Not running: a realtime NO_SERVICE alert for the whole line, or a closure exception. */
    SUSPENDED,
    /** Running, but under an active alert that affects service (delays, reduced service, …). */
    DISRUPTED,
    /** No timetable for this line and day, and no observation either way. Never guessed. */
    UNKNOWN
}
