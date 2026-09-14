package com.nammametro.simulation.trainsim.analytics;

import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.api.rest.dto.analytics.AnalyticsResponse;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import com.nammametro.simulation.trainsim.domain.model.BlockState;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Builds the {@code GET /api/simulation/analytics} response — the only place that turns
 * {@link AnalyticsRecorder}'s raw ticks plus the current {@link SimulationState} into the metrics
 * and chart series the dashboard renders. Every number traces back to either the live state
 * ({@code LIVE}) or a real recorded tick ({@code SIMULATION_RESULT}/{@code HISTORICAL}) — nothing
 * here is estimated, interpolated across a gap, or filled in for a bucket that had no actual sample.
 *
 * <p>Unlike most {@code trainsim} services, this one builds its own API response DTOs directly
 * ({@link AnalyticsResponse}) rather than a separate domain object a {@code *Response.from(...)}
 * static method later maps — there is no other consumer of "an analytics result" inside the engine,
 * so the usual domain/DTO split would just be a second copy of the same shape.
 */
@Service
public class AnalyticsService {

    private static final int TARGET_BUCKET_COUNT = 60;
    private static final int MIN_BUCKET_SECONDS = 60;
    private static final long CURRENT_HOUR_SECONDS = 3600;

    /** Live queue-length bands a station's congestion is classified into — a simple, documented
     * heuristic over the real current queue, not a measured real-world threshold. */
    private static final int CONGESTION_MEDIUM_AT = 5;
    private static final int CONGESTION_HIGH_AT = 15;

    private final MetroNetwork network;
    private final AnalyticsRecorder recorder;
    private final TrainSimulationControlUseCase simulation;

    public AnalyticsService(MetroNetwork network, AnalyticsRecorder recorder, TrainSimulationControlUseCase simulation) {
        this.network = network;
        this.recorder = recorder;
        this.simulation = simulation;
    }

    public AnalyticsResponse compute(AnalyticsRange range, Instant customFrom, Instant customTo) {
        SimulationState state = simulation.getState();
        SimulationClock clock = state.clock();
        List<TickSample> all = recorder.allSamples();
        long latestElapsed = all.isEmpty() ? clock.elapsedSimulationSeconds() : all.get(all.size() - 1).elapsedSimulationSeconds();

        long[] bounds = resolveRange(range, customFrom, customTo, clock, latestElapsed);
        long fromSeconds = bounds[0];
        long toSeconds = bounds[1];

        List<TickSample> window = all.stream()
                .filter(s -> s.elapsedSimulationSeconds() >= fromSeconds && s.elapsedSimulationSeconds() <= toSeconds)
                .toList();
        TickSample baseline = lastSampleAtOrBefore(all, fromSeconds);

        AnalyticsResponse.Meta meta = new AnalyticsResponse.Meta(
                range.name(),
                clock.startTime().plusSeconds(fromSeconds).toString(),
                clock.startTime().plusSeconds(toSeconds).toString(),
                fromSeconds, toSeconds,
                clock.currentTime().toString(), clock.currentTick());

        return new AnalyticsResponse(meta, buildLive(state), buildSimulationResult(window, baseline), buildHistorical(window, fromSeconds, toSeconds));
    }

    private long[] resolveRange(AnalyticsRange range, Instant customFrom, Instant customTo, SimulationClock clock,
                                 long latestElapsed) {
        return switch (range) {
            case FULL -> new long[]{0, latestElapsed};
            case CURRENT_HOUR -> new long[]{Math.max(0, latestElapsed - CURRENT_HOUR_SECONDS), latestElapsed};
            case CUSTOM -> {
                if (customFrom == null || customTo == null) {
                    throw new IllegalArgumentException("range=CUSTOM requires both 'from' and 'to' query parameters");
                }
                long from = clamp(Duration.between(clock.startTime(), customFrom).getSeconds(), latestElapsed);
                long to = clamp(Duration.between(clock.startTime(), customTo).getSeconds(), latestElapsed);
                if (from > to) {
                    throw new IllegalArgumentException("'from' must not be after 'to'");
                }
                yield new long[]{from, to};
            }
        };
    }

    /** Both bounds of a CUSTOM range are clamped into {@code [0, latestElapsed]} — a caller picking
     * a wall-clock datetime outside the simulation's own (unrelated) clock range, in either
     * direction, lands on the nearest valid edge rather than producing an inverted or
     * out-of-bounds window. */
    private long clamp(long seconds, long latestElapsed) {
        return Math.max(0, Math.min(latestElapsed, seconds));
    }

    // ---- LIVE ----------------------------------------------------------------------------------

    private AnalyticsResponse.Live buildLive(SimulationState state) {
        int totalTrains = state.trains().size();
        int activeTrains = 0;
        double sumDelay = 0;
        int maxDelay = 0;
        double sumSpeed = 0;
        int movingTrains = 0;
        double sumOccupancy = 0;
        int occupancyTrains = 0;

        for (TrainState t : state.trains()) {
            boolean inService = t.status() != TrainStatus.SCHEDULED && t.status() != TrainStatus.COMPLETED;
            if (!inService) {
                continue;
            }
            activeTrains++;
            sumDelay += t.delaySeconds();
            maxDelay = Math.max(maxDelay, t.delaySeconds());
            if (t.status() == TrainStatus.DEPARTING || t.status() == TrainStatus.RUNNING) {
                sumSpeed += t.speedKmph();
                movingTrains++;
            }
            if (t.capacity() > 0) {
                sumOccupancy += (double) t.passengerCount() / t.capacity();
                occupancyTrains++;
            }
        }

        long occupiedOrReserved = state.signals().stream()
                .filter(s -> s.blockState() != BlockState.FREE)
                .count();
        double networkUtilizationPct = state.signals().isEmpty() ? 0.0
                : 100.0 * occupiedOrReserved / state.signals().size();
        long activeDisruptions = state.disruptions().stream().filter(Disruption::isActive).count();

        AnalyticsResponse.Live.Network networkMetrics = new AnalyticsResponse.Live.Network(
                activeTrains, network.allStations().size(), networkUtilizationPct, (int) activeDisruptions);
        AnalyticsResponse.Live.Trains trainsMetrics = new AnalyticsResponse.Live.Trains(
                movingTrains == 0 ? 0.0 : sumSpeed / movingTrains,
                activeTrains == 0 ? 0.0 : sumDelay / activeTrains,
                maxDelay,
                totalTrains == 0 ? 0.0 : 100.0 * activeTrains / totalTrains);
        double currentAvgOccupancyPct = occupancyTrains == 0 ? 0.0 : 100.0 * sumOccupancy / occupancyTrains;

        Map<Long, StationAggregate> stationAggregates = recorder.stationAggregatesSnapshot();
        List<AnalyticsResponse.Live.StationLive> stations = new ArrayList<>();
        for (Station station : network.allStations()) {
            StationAggregate agg = stationAggregates.get(station.id());
            int queue = agg == null ? 0 : agg.currentQueue();
            stations.add(new AnalyticsResponse.Live.StationLive(
                    station.id(), station.code(), station.name(), queue, station.dwellTimeSeconds(),
                    congestionLevel(queue)));
        }

        return new AnalyticsResponse.Live("LIVE", networkMetrics, trainsMetrics, currentAvgOccupancyPct, stations,
                waitHistogram(state));
    }

    private String congestionLevel(int queue) {
        if (queue >= CONGESTION_HIGH_AT) {
            return "HIGH";
        }
        return queue >= CONGESTION_MEDIUM_AT ? "MEDIUM" : "LOW";
    }

    /** Only ever counts passengers still {@link PassengerStatus#WAITING} for their first train —
     * {@link PassengerStatus#TRANSFER} passengers have no per-leg wait-start timestamp in
     * {@link Passenger} (only the original {@code arrivalTimeSeconds}), so including them would mean
     * reporting a wait duration that isn't actually theirs for this leg. */
    private List<AnalyticsResponse.Live.WaitTimeBucket> waitHistogram(SimulationState state) {
        long now = state.clock().elapsedSimulationSeconds();
        int under2 = 0, under5 = 0, under10 = 0, under15 = 0, over15 = 0;
        for (Passenger p : state.passengers()) {
            if (p.status() != PassengerStatus.WAITING) {
                continue;
            }
            long waited = now - p.arrivalTimeSeconds();
            if (waited < 120) {
                under2++;
            } else if (waited < 300) {
                under5++;
            } else if (waited < 600) {
                under10++;
            } else if (waited < 900) {
                under15++;
            } else {
                over15++;
            }
        }
        return List.of(
                new AnalyticsResponse.Live.WaitTimeBucket("0-2 min", under2),
                new AnalyticsResponse.Live.WaitTimeBucket("2-5 min", under5),
                new AnalyticsResponse.Live.WaitTimeBucket("5-10 min", under10),
                new AnalyticsResponse.Live.WaitTimeBucket("10-15 min", under15),
                new AnalyticsResponse.Live.WaitTimeBucket("15+ min", over15));
    }

    // ---- SIMULATION RESULT -----------------------------------------------------------------------

    private AnalyticsResponse.SimulationResult buildSimulationResult(List<TickSample> window, TickSample baseline) {
        double sumUtilization = 0;
        int utilizationSamples = 0;
        double sumSpeed = 0;
        int movingTrainTicks = 0;
        long sumDelay = 0;
        int maxDelay = 0;
        long sumOnTime = 0;
        long sumActive = 0;
        double sumOccupancy = 0;
        int occupancyTrainTicks = 0;

        for (TickSample s : window) {
            sumUtilization += s.networkUtilizationFraction();
            utilizationSamples++;
            sumSpeed += s.sumSpeedKmph();
            movingTrainTicks += s.movingTrainCount();
            sumDelay += s.sumDelaySeconds();
            maxDelay = Math.max(maxDelay, s.maxDelaySeconds());
            sumOnTime += s.onTimeTrainCount();
            sumActive += s.activeTrainCount();
            sumOccupancy += s.sumOccupancyFraction();
            occupancyTrainTicks += s.occupancyTrainCount();
        }

        AnalyticsResponse.SimulationResult.Network networkMetrics = new AnalyticsResponse.SimulationResult.Network(
                utilizationSamples == 0 ? 0.0 : 100.0 * sumUtilization / utilizationSamples);

        AnalyticsResponse.SimulationResult.Trains trainsMetrics = new AnalyticsResponse.SimulationResult.Trains(
                movingTrainTicks == 0 ? 0.0 : sumSpeed / movingTrainTicks,
                sumActive == 0 ? 0.0 : (double) sumDelay / sumActive,
                maxDelay,
                sumActive == 0 ? 0.0 : 100.0 * sumOnTime / sumActive,
                window.isEmpty() ? 0.0 : 100.0 * window.stream().mapToDouble(TickSample::trainUtilizationFraction).average().orElse(0));

        long baseGenerated = baseline == null ? 0 : baseline.totalGenerated();
        long baseServed = baseline == null ? 0 : baseline.totalServed();
        long baseUnableToBoard = baseline == null ? 0 : baseline.totalUnableToBoard();
        long baseWait = baseline == null ? 0 : baseline.totalWaitSeconds();
        long baseJourney = baseline == null ? 0 : baseline.totalJourneySeconds();

        TickSample last = window.isEmpty() ? baseline : window.get(window.size() - 1);
        long totalGenerated = last == null ? 0 : last.totalGenerated() - baseGenerated;
        long totalCompleted = last == null ? 0 : last.totalServed() - baseServed;
        long unableToBoard = last == null ? 0 : last.totalUnableToBoard() - baseUnableToBoard;
        long servedInWindow = totalCompleted;
        double avgWaitingSeconds = servedInWindow <= 0 ? 0.0 : (double) (last.totalWaitSeconds() - baseWait) / servedInWindow;
        double avgJourneySeconds = servedInWindow <= 0 ? 0.0 : (double) (last.totalJourneySeconds() - baseJourney) / servedInWindow;
        double avgOccupancyPct = occupancyTrainTicks == 0 ? 0.0 : 100.0 * sumOccupancy / occupancyTrainTicks;

        AnalyticsResponse.SimulationResult.Passengers passengersMetrics = new AnalyticsResponse.SimulationResult.Passengers(
                totalGenerated, totalCompleted, avgWaitingSeconds, avgJourneySeconds, avgOccupancyPct, unableToBoard);

        List<AnalyticsResponse.SimulationResult.StationResult> stations = new ArrayList<>();
        Map<Long, StationAggregate> stationAggregates = recorder.stationAggregatesSnapshot();
        for (Station station : network.allStations()) {
            StationAggregate agg = stationAggregates.get(station.id());
            long throughput = agg == null ? 0 : agg.throughput();
            double avgQueue = agg == null ? 0.0 : agg.averageQueue();
            int maxQueue = agg == null ? 0 : agg.maxQueueSeen();
            stations.add(new AnalyticsResponse.SimulationResult.StationResult(
                    station.id(), station.code(), station.name(), throughput, avgQueue, maxQueue,
                    station.dwellTimeSeconds()));
        }

        return new AnalyticsResponse.SimulationResult("SIMULATION_RESULT", networkMetrics, trainsMetrics, passengersMetrics, stations);
    }

    // ---- HISTORICAL ------------------------------------------------------------------------------

    /**
     * Buckets {@code window} into up to {@link #TARGET_BUCKET_COUNT} fixed-width windows and emits
     * one point per bucket that actually contains a recorded sample — an empty bucket (possible at
     * high simulation speeds, where a single tick can span many simulated seconds) is skipped rather
     * than interpolated or zero-filled, so every point on every chart traces back to a real tick.
     */
    private AnalyticsResponse.Historical buildHistorical(List<TickSample> window, long fromSeconds, long toSeconds) {
        long rangeSeconds = Math.max(1, toSeconds - fromSeconds);
        int bucketSeconds = (int) Math.max(MIN_BUCKET_SECONDS, Math.ceil((double) rangeSeconds / TARGET_BUCKET_COUNT));

        Map<Long, List<TickSample>> byBucket = new TreeMap<>();
        for (TickSample s : window) {
            long bucketStart = fromSeconds + ((s.elapsedSimulationSeconds() - fromSeconds) / bucketSeconds) * bucketSeconds;
            byBucket.computeIfAbsent(bucketStart, k -> new ArrayList<>()).add(s);
        }

        List<AnalyticsResponse.Historical.Point> passengerDemand = new ArrayList<>();
        List<AnalyticsResponse.Historical.Point> trainOccupancy = new ArrayList<>();
        List<AnalyticsResponse.Historical.DelayPoint> delay = new ArrayList<>();
        List<AnalyticsResponse.Historical.Point> trainsOperating = new ArrayList<>();

        List<TickSample> all = recorder.allSamples();
        TickSample baseline = lastSampleAtOrBefore(all, fromSeconds);
        long lastGenerated = baseline == null ? 0 : baseline.totalGenerated();

        for (Map.Entry<Long, List<TickSample>> entry : byBucket.entrySet()) {
            List<TickSample> bucketSamples = entry.getValue();
            TickSample bucketEnd = bucketSamples.get(bucketSamples.size() - 1);
            String simTime = Instant.ofEpochSecond(bucketEnd.simTimeEpochSeconds()).toString();

            passengerDemand.add(new AnalyticsResponse.Historical.Point(
                    bucketEnd.elapsedSimulationSeconds(), simTime, bucketEnd.totalGenerated() - lastGenerated));
            lastGenerated = bucketEnd.totalGenerated();

            double sumOccupancyFraction = bucketSamples.stream().mapToDouble(TickSample::sumOccupancyFraction).sum();
            int occupancyCount = bucketSamples.stream().mapToInt(TickSample::occupancyTrainCount).sum();
            trainOccupancy.add(new AnalyticsResponse.Historical.Point(
                    bucketEnd.elapsedSimulationSeconds(), simTime,
                    occupancyCount == 0 ? 0.0 : 100.0 * sumOccupancyFraction / occupancyCount));

            long sumDelay = bucketSamples.stream().mapToLong(TickSample::sumDelaySeconds).sum();
            int activeCount = bucketSamples.stream().mapToInt(TickSample::activeTrainCount).sum();
            int maxDelay = bucketSamples.stream().mapToInt(TickSample::maxDelaySeconds).max().orElse(0);
            delay.add(new AnalyticsResponse.Historical.DelayPoint(
                    bucketEnd.elapsedSimulationSeconds(), simTime,
                    activeCount == 0 ? 0.0 : (double) sumDelay / activeCount, maxDelay));

            double avgActive = bucketSamples.stream().mapToInt(TickSample::activeTrainCount).average().orElse(0);
            trainsOperating.add(new AnalyticsResponse.Historical.Point(
                    bucketEnd.elapsedSimulationSeconds(), simTime, avgActive));
        }

        return new AnalyticsResponse.Historical("HISTORICAL", bucketSeconds, passengerDemand, trainOccupancy, delay, trainsOperating);
    }

    private TickSample lastSampleAtOrBefore(List<TickSample> samples, long elapsedSeconds) {
        TickSample result = null;
        for (TickSample s : samples) {
            if (s.elapsedSimulationSeconds() > elapsedSeconds) {
                break;
            }
            result = s;
        }
        return result;
    }
}
