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
 */
public record TickSample(
        long tick,
        long elapsedSimulationSeconds,
        long simTimeEpochSeconds,

        int totalTrainCount,
        int activeTrainCount,
        int onTimeTrainCount,

        double sumSpeedKmph,
        int movingTrainCount,

        long sumHeldSeconds,
        int heldTrainCount,
        int maxHeldSeconds,

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

    public double avgHeldSeconds() {
        return heldTrainCount == 0 ? 0.0 : (double) sumHeldSeconds / heldTrainCount;
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
