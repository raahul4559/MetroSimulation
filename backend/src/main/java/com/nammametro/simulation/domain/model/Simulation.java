package com.nammametro.simulation.domain.model;

import java.time.Duration;

/**
 * The simulation's current state. Immutable — the engine advances the clock by producing a new
 * instance each tick rather than mutating one in place.
 */
public record Simulation(
        SimulationStatus status,
        long currentTick,
        Duration elapsedSimulationTime,
        SimulationConfig config
) {

    public static Simulation initial(SimulationConfig config) {
        return new Simulation(SimulationStatus.STOPPED, 0L, Duration.ZERO, config);
    }

    public Simulation withNextTick() {
        long nextTick = currentTick + 1;
        long elapsedMs = (long) (nextTick * config.tickIntervalMs() * config.timeScale());
        return new Simulation(status, nextTick, Duration.ofMillis(elapsedMs), config);
    }

    public Simulation withStatus(SimulationStatus newStatus) {
        return new Simulation(newStatus, currentTick, elapsedSimulationTime, config);
    }
}
