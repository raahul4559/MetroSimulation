package com.nammametro.simulation.trainsim.analytics;

/**
 * A station's cumulative-since-reset activity, as seen by {@link AnalyticsRecorder} — an immutable
 * snapshot of the mutable running totals it accumulates every tick. Unlike {@link TickSample}, this
 * is never range-scoped: per-station history isn't retained tick-by-tick (that's a lot of mostly-zero
 * data for dozens of stations over a long run), so a station's numbers are always "since the
 * simulation last reset," regardless of the analytics time-range filter applied elsewhere.
 *
 * <p>{@code queueSampleSum}/{@code queueSampleCount} are, like {@link TickSample}'s sum/count pairs,
 * kept unaveraged so {@link #averageQueue()} is a true per-tick mean rather than an average of
 * averages.
 */
public record StationAggregate(
        long stationId,
        long boardedTotal,
        long alightedTotal,
        long queueSampleSum,
        long queueSampleCount,
        int maxQueueSeen,
        int currentQueue
) {

    static StationAggregate empty(long stationId) {
        return new StationAggregate(stationId, 0, 0, 0, 0, 0, 0);
    }

    public double averageQueue() {
        return queueSampleCount == 0 ? 0.0 : (double) queueSampleSum / queueSampleCount;
    }

    public long throughput() {
        return boardedTotal + alightedTotal;
    }
}
