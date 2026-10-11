package com.nammametro.simulation.realtime.domain;

/**
 * Where a train's position came from. Every train in the canonical {@link MetroState} carries one,
 * and every label the frontend shows is derived from it — never from whether a socket happens to
 * be connected.
 *
 * <ul>
 *   <li>{@link #LIVE} — an authorized/official operator feed (see {@code OfficialRealtimeProvider}).
 *       Observed positions.</li>
 *   <li>{@link #GTFS_REALTIME} — a GTFS-Realtime feed (see {@code GtfsRealtimeProvider}). Observed
 *       positions.</li>
 *   <li>{@link #SCHEDULE} — where the configured timetable says a train should be right now (see
 *       {@code ScheduleProvider}). An estimate, never an observation.</li>
 *   <li>{@link #SIMULATION} — the discrete-time simulation engine ({@code trainsim}). Invented by
 *       construction.</li>
 * </ul>
 */
public enum DataSource {
    LIVE,
    GTFS_REALTIME,
    SCHEDULE,
    SIMULATION;

    /** True only for sources that report trains someone actually observed. {@link #SCHEDULE} and
     * {@link #SIMULATION} are never realtime, no matter how healthy they are. */
    public boolean isObserved() {
        return this == LIVE || this == GTFS_REALTIME;
    }
}
