package com.nammametro.simulation.trainsim.analytics;

/**
 * One tick's worth of pre-aggregated raw numbers, recorded by {@link AnalyticsRecorder} right after
 * every tick — the row a chart's time series or a range's summary is built from. Deliberately holds
 * sums/counts rather than pre-divided averages ({@code sumSpeedKmph}/{@code movingTrainCount}, not
 * {@code avgSpeedKmph}): aggregating a range by summing the numerators and denominators separately
 * and dividing once at the end is a weighted mean (more correct than averaging a list of per-tick
 * averages), and it's exactly as cheap to compute either way at record time.
 *
 * <p>{@code totalGenerated}..{@code totalJourneySeconds} mirror {@code PassengerMetrics}'s own
 * fields verbatim — cumulative-since-reset counters, not per-tick deltas. A range's passenger totals
 * are the difference between the last sample in range and the first, which is why the raw cumulative
 * values (not deltas) are what gets stored here.
 *
 * <p>{@code sumDelaySeconds}/{@code maxDelaySeconds} are read from every active train's own
 * {@code TrainState#delaySeconds()} — "seconds behind nominal schedule right now, 0 if on time,"
 * recomputed live every tick by {@code TrainMovementTickHandler} — not derived from headway-hold
 * state here, so a train that's still nominally late while back to {@code RUNNING} (recovering from
 * an earlier hold) still counts. {@code sumDelaySeconds} is summed over every active train
 * (including on-time ones at 0), so {@link #avgDelaySeconds()} divides by {@code activeTrainCount}
 * rather than a separate held-train count.
 */
public record TickSample(
        long tick,
        long elapsedSimulationSeconds,
        long simTimeEpochSeconds,

        int totalTrainCount,
        int activeTrainCount,
        int onTimeTrainCount,
        int activeDisruptions,

        double sumSpeedKmph,
        int movingTrainCount,

        long sumDelaySeconds,
        int maxDelaySeconds,

        double sumOccupancyFraction,
        int occupancyTrainCount,

        int occupiedOrReservedTracks,
        int totalTracks,

        long totalGenerated,
        long totalServed,
        long totalUnableToBoard,
        long totalWaitSeconds,
        long totalTravelSeconds,
        long totalJourneySeconds
) {

    public double avgSpeedKmph() {
        return movingTrainCount == 0 ? 0.0 : sumSpeedKmph / movingTrainCount;
    }

    public double avgDelaySeconds() {
        return activeTrainCount == 0 ? 0.0 : (double) sumDelaySeconds / activeTrainCount;
    }

    public double avgOccupancyFraction() {
        return occupancyTrainCount == 0 ? 0.0 : sumOccupancyFraction / occupancyTrainCount;
    }

    public double onTimeFraction() {
        return activeTrainCount == 0 ? 0.0 : (double) onTimeTrainCount / activeTrainCount;
    }

    public double networkUtilizationFraction() {
        return totalTracks == 0 ? 0.0 : (double) occupiedOrReservedTracks / totalTracks;
    }

    public double trainUtilizationFraction() {
        return totalTrainCount == 0 ? 0.0 : (double) activeTrainCount / totalTrainCount;
    }
}
