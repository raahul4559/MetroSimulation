package com.nammametro.simulation.trainsim.domain.model;

/**
 * Deterministic, read-only engine parameters — loaded once from {@code simulation_config} at
 * startup/reset and never mutated mid-run, which is what makes "same config in ⇒ same result out"
 * hold.
 */
public record EngineSettings(
        int baseSimSecondsPerTick,
        int minHeadwaySeconds,
        int delayThresholdSeconds,
        long randomSeed
) {

    /** Simulated seconds a single tick represents at the given speed. */
    public long deltaSecondsFor(SimulationSpeed speed) {
        return Math.round(baseSimSecondsPerTick * speed.multiplier());
    }
}
