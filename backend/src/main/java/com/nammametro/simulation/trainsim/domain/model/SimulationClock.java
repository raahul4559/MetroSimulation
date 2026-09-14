package com.nammametro.simulation.trainsim.domain.model;

import com.nammametro.simulation.domain.model.SimulationStatus;

import java.time.Instant;

/**
 * The simulation's virtual clock — deliberately never reads wall-clock time. {@code currentTick}
 * and {@code elapsedSimulationSeconds} only ever advance by a fixed amount per tick
 * ({@code baseSimSecondsPerTick * speed.multiplier()}), so replaying the same number of ticks from
 * the same {@link #startTime} and {@link #speed} always yields the same {@link #currentTime()} —
 * the determinism the engine as a whole depends on.
 */
public record SimulationClock(
        Instant startTime,
        SimulationStatus status,
        SimulationSpeed speed,
        long currentTick,
        long elapsedSimulationSeconds
) {

    public Instant currentTime() {
        return startTime.plusSeconds(elapsedSimulationSeconds);
    }

    public SimulationClock withStatus(SimulationStatus newStatus) {
        return new SimulationClock(startTime, newStatus, speed, currentTick, elapsedSimulationSeconds);
    }

    public SimulationClock withSpeed(SimulationSpeed newSpeed) {
        return new SimulationClock(startTime, status, newSpeed, currentTick, elapsedSimulationSeconds);
    }

    public SimulationClock advanced(long deltaSeconds) {
        return new SimulationClock(startTime, status, speed, currentTick + 1, elapsedSimulationSeconds + deltaSeconds);
    }
}
