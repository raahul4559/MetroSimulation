package com.nammametro.simulation.trainsim.analytics;

/**
 * The three time windows {@code AnalyticsService} can scope the "simulation result" totals and
 * "historical" chart series to (see the dashboard's Time Range picker). {@code CURRENT_HOUR} and
 * {@code CUSTOM} are both resolved against the simulated clock's elapsed seconds, never wall-clock
 * time — consistent with the rest of the engine never reading {@code Instant.now()}.
 */
public enum AnalyticsRange {
    CURRENT_HOUR,
    FULL,
    CUSTOM
}
