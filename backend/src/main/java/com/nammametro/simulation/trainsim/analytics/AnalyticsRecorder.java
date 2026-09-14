package com.nammametro.simulation.trainsim.analytics;

import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.domain.model.BlockState;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Records one {@link TickSample} (plus per-station running totals) after every tick the engine
 * processes — the sole source, alongside the live {@code SimulationState} itself, that
 * {@code AnalyticsService} builds every metric and chart from. Never fabricates a number: everything
 * here is read straight off the {@link SimulationState} a tick actually produced.
 *
 * <p>Deliberately mutable and synchronized, unlike the rest of {@code trainsim}'s "replace the whole
 * record every tick" domain style — this is a recording sidecar bolted onto the engine, not part of
 * its deterministic tick pipeline, and an unbounded-growth append-only structure (ticks accumulate
 * for as long as a run lasts) is a poor fit for copy-on-write immutability. {@link #record} runs on
 * the engine's scheduler thread; every read runs on an HTTP thread — {@code synchronized} is enough
 * given how infrequently (once a tick, at most a few times a second) this is touched.
 *
 * <p>Bounded at {@value #MAX_SAMPLES} ticks (oldest evicted first) so a very long-running simulation
 * can't grow this without limit; at the default one-tick-per-second schedule that's roughly a day and
 * a half of wall-clock run time, far beyond any real session.
 */
@Component
public class AnalyticsRecorder {

    private static final int MAX_SAMPLES = 100_000;

    private final MetroNetwork network;
    private final Deque<TickSample> samples = new ArrayDeque<>();
    private final Map<Long, MutableStationAggregate> stationAggregates = new HashMap<>();

    public AnalyticsRecorder(MetroNetwork network) {
        this.network = network;
    }

    public synchronized void record(SimulationState state) {
        samples.addLast(sampleFrom(state));
        if (samples.size() > MAX_SAMPLES) {
            samples.removeFirst();
        }
        updateStationAggregates(state);
    }

    public synchronized void reset() {
        samples.clear();
        stationAggregates.clear();
    }

    /** Every retained sample, oldest first. */
    public synchronized List<TickSample> allSamples() {
        return List.copyOf(samples);
    }

    /** Retained samples whose {@code elapsedSimulationSeconds} falls in {@code [fromSeconds, toSeconds]}. */
    public synchronized List<TickSample> samplesInRange(long fromSeconds, long toSeconds) {
        List<TickSample> result = new ArrayList<>();
        for (TickSample s : samples) {
            if (s.elapsedSimulationSeconds() >= fromSeconds && s.elapsedSimulationSeconds() <= toSeconds) {
                result.add(s);
            }
        }
        return result;
    }

    /** The most recently recorded sample's simulated-elapsed-seconds, or 0 if nothing recorded yet. */
    public synchronized long latestElapsedSeconds() {
        return samples.isEmpty() ? 0 : samples.getLast().elapsedSimulationSeconds();
    }

    public synchronized Map<Long, StationAggregate> stationAggregatesSnapshot() {
        Map<Long, StationAggregate> snapshot = new HashMap<>();
        stationAggregates.forEach((id, agg) -> snapshot.put(id, agg.toSnapshot()));
        return snapshot;
    }

    private TickSample sampleFrom(SimulationState state) {
        int totalTrainCount = state.trains().size();
        int activeTrainCount = 0;
        int onTimeTrainCount = 0;
        double sumSpeedKmph = 0;
        int movingTrainCount = 0;
        long sumDelaySeconds = 0;
        int maxDelaySeconds = 0;
        double sumOccupancyFraction = 0;
        int occupancyTrainCount = 0;

        for (TrainState train : state.trains()) {
            boolean inService = train.status() != TrainStatus.SCHEDULED && train.status() != TrainStatus.COMPLETED;
            if (!inService) {
                continue;
            }
            activeTrainCount++;
            sumDelaySeconds += train.delaySeconds();
            maxDelaySeconds = Math.max(maxDelaySeconds, train.delaySeconds());
            if (train.delaySeconds() <= 0) {
                onTimeTrainCount++;
            }
            if (train.status() == TrainStatus.DEPARTING || train.status() == TrainStatus.RUNNING) {
                sumSpeedKmph += train.speedKmph();
                movingTrainCount++;
            }
            if (train.capacity() > 0) {
                sumOccupancyFraction += (double) train.passengerCount() / train.capacity();
                occupancyTrainCount++;
            }
        }

        int occupiedOrReserved = (int) state.signals().stream()
                .filter(s -> s.blockState() != BlockState.FREE)
                .count();
        int activeDisruptions = (int) state.disruptions().stream().filter(Disruption::isActive).count();

        PassengerMetrics metrics = state.passengerMetrics();

        return new TickSample(
                state.clock().currentTick(),
                state.clock().elapsedSimulationSeconds(),
                state.clock().currentTime().getEpochSecond(),
                totalTrainCount, activeTrainCount, onTimeTrainCount, activeDisruptions,
                sumSpeedKmph, movingTrainCount,
                sumDelaySeconds, maxDelaySeconds,
                sumOccupancyFraction, occupancyTrainCount,
                occupiedOrReserved, state.signals().size(),
                metrics.totalGenerated(), metrics.totalServed(), metrics.totalUnableToBoard(),
                metrics.totalWaitSeconds(), metrics.totalTravelSeconds(), metrics.totalJourneySeconds());
    }

    /**
     * Every network station is observed every tick — including a 0-queue observation for a station
     * nobody is waiting at — so {@link StationAggregate#averageQueue()} is a true time-average over
     * the whole run, not just an average over the ticks a queue happened to be non-empty.
     */
    private void updateStationAggregates(SimulationState state) {
        Map<Long, TrainState> trainsById = new HashMap<>();
        for (TrainState t : state.trains()) {
            trainsById.put(t.id(), t);
        }

        Map<Long, Integer> queueByStation = new HashMap<>();
        Map<Long, Integer> boardedByStation = new HashMap<>();
        Map<Long, Integer> alightedByStation = new HashMap<>();

        for (Passenger p : state.passengers()) {
            switch (p.status()) {
                case WAITING, TRANSFER -> {
                    if (p.currentStationId() != null) {
                        queueByStation.merge(p.currentStationId(), 1, Integer::sum);
                    }
                }
                case ALIGHTING -> {
                    if (p.currentStationId() != null) {
                        alightedByStation.merge(p.currentStationId(), 1, Integer::sum);
                    }
                }
                case BOARDING -> {
                    // BOARDING passengers carry currentTrainId, not currentStationId (see Passenger's
                    // javadoc) — the boarding station is the train's own previousStationId, which
                    // TrainMovementTickHandler preserves through the AT_STATION -> DWELLING transition
                    // this same tick.
                    TrainState train = p.currentTrainId() == null ? null : trainsById.get(p.currentTrainId());
                    if (train != null) {
                        boardedByStation.merge(train.previousStationId(), 1, Integer::sum);
                    }
                }
                default -> {
                    // ON_TRAIN / COMPLETED: not attributable to a station this tick.
                }
            }
        }

        for (Station station : network.allStations()) {
            MutableStationAggregate agg = stationAggregates.computeIfAbsent(station.id(), MutableStationAggregate::new);
            agg.observeQueue(queueByStation.getOrDefault(station.id(), 0));
            agg.addBoarded(boardedByStation.getOrDefault(station.id(), 0));
            agg.addAlighted(alightedByStation.getOrDefault(station.id(), 0));
        }
    }

    /** Package-private mutable accumulator behind {@link StationAggregate}'s immutable snapshots. */
    private static final class MutableStationAggregate {
        private final long stationId;
        private long boardedTotal;
        private long alightedTotal;
        private long queueSampleSum;
        private long queueSampleCount;
        private int maxQueueSeen;
        private int currentQueue;

        MutableStationAggregate(long stationId) {
            this.stationId = stationId;
        }

        void observeQueue(int queue) {
            currentQueue = queue;
            queueSampleSum += queue;
            queueSampleCount++;
            maxQueueSeen = Math.max(maxQueueSeen, queue);
        }

        void addBoarded(int count) {
            boardedTotal += count;
        }

        void addAlighted(int count) {
            alightedTotal += count;
        }

        StationAggregate toSnapshot() {
            return new StationAggregate(stationId, boardedTotal, alightedTotal, queueSampleSum, queueSampleCount,
                    maxQueueSeen, currentQueue);
        }
    }
}
