package com.nammametro.simulation.realtime.domain;

/**
 * Which source the operator asked the canonical state to be built from. {@link #AUTO} walks
 * {@code LIVE -> GTFS_REALTIME -> SCHEDULE -> SIMULATION} and takes the first one that can
 * currently answer; every other value pins one source and never silently falls back — if a pinned
 * realtime feed goes down, the state says so (stale, or empty with a reason) rather than quietly
 * substituting simulated trains.
 */
public enum RealtimeMode {
    AUTO,
    LIVE,
    GTFS_REALTIME,
    SCHEDULE,
    SIMULATION;

    public DataSource pinnedSource() {
        return switch (this) {
            case AUTO -> null;
            case LIVE -> DataSource.LIVE;
            case GTFS_REALTIME -> DataSource.GTFS_REALTIME;
            case SCHEDULE -> DataSource.SCHEDULE;
            case SIMULATION -> DataSource.SIMULATION;
        };
    }
}
