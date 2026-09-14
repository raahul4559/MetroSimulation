package com.nammametro.simulation.trainsim.api.rest.dto.analytics;

import java.util.List;

/**
 * The whole {@code GET /api/simulation/analytics} payload, built by {@code AnalyticsService} and
 * nothing else — unlike most DTOs in this codebase, there is no separate domain object this wraps
 * (see the service's javadoc for why), so its nested records live here rather than mirroring a
 * {@code trainsim.domain.model} type.
 *
 * <p>The three top-level sections each carry their own {@code kind} literal
 * ({@code "LIVE"}/{@code "SIMULATION_RESULT"}/{@code "HISTORICAL"}) precisely so the frontend never
 * has to hardcode which section means what — it reads the label straight off the data it's
 * rendering, which is the whole point of keeping the three clearly distinguished.
 *
 * <ul>
 *   <li>{@code live} — this instant, read directly off the current {@code SimulationState}. Always
 *       "now," regardless of {@code meta.range}.
 *   <li>{@code simulationResult} — totals and rates aggregated over {@code meta.range}: what actually
 *       happened, not a live reading.
 *   <li>{@code historical} — time-bucketed series over {@code meta.range}, what the charts render.
 * </ul>
 */
public record AnalyticsResponse(
        Meta meta,
        Live live,
        SimulationResult simulationResult,
        Historical historical
) {

    public record Meta(
            String range,
            String fromSimTime,
            String toSimTime,
            long fromElapsedSeconds,
            long toElapsedSeconds,
            String generatedAtSimTime,
            long generatedAtTick
    ) {
    }

    // ---- LIVE ----------------------------------------------------------------------------------

    public record Live(
            String kind,
            Network network,
            Trains trains,
            double currentAvgOccupancyPct,
            List<StationLive> stations,
            List<WaitTimeBucket> passengerWaitHistogram
    ) {
        public record Network(int activeTrains, int activeStations, double networkUtilizationPct) {
        }

        public record Trains(double avgSpeedKmph, double currentAvgDelaySeconds, double currentMaxDelaySeconds,
                              double trainUtilizationPct) {
        }

        public record StationLive(long stationId, String code, String name, int currentQueue,
                                   int dwellTimeSeconds, String congestionLevel) {
        }

        public record WaitTimeBucket(String label, int passengerCount) {
        }
    }

    // ---- SIMULATION RESULT -----------------------------------------------------------------------

    public record SimulationResult(
            String kind,
            Network network,
            Trains trains,
            Passengers passengers,
            List<StationResult> stations
    ) {
        public record Network(double avgNetworkUtilizationPct) {
        }

        public record Trains(double avgSpeedKmph, double avgDelaySeconds, double maxDelaySeconds,
                              double onTimePct, double avgUtilizationPct) {
        }

        public record Passengers(long totalGenerated, long totalCompleted, double avgWaitingSeconds,
                                  double avgJourneySeconds, double avgOccupancyPct, long unableToBoard) {
        }

        public record StationResult(long stationId, String code, String name, long throughput, double avgQueue,
                                     int maxQueue, int dwellTimeSeconds) {
        }
    }

    // ---- HISTORICAL ------------------------------------------------------------------------------

    public record Historical(
            String kind,
            int bucketSeconds,
            List<Point> passengerDemand,
            List<Point> trainOccupancyPct,
            List<DelayPoint> delay,
            List<Point> trainsOperating
    ) {
        public record Point(long elapsedSimulationSeconds, String simTime, double value) {
        }

        public record DelayPoint(long elapsedSimulationSeconds, String simTime, double avgDelaySeconds,
                                  double maxDelaySeconds) {
        }
    }
}
