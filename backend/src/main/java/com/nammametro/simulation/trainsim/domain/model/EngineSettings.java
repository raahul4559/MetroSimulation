package com.nammametro.simulation.trainsim.domain.model;

/**
 * Deterministic, read-only engine parameters — loaded once from {@code simulation_config} at
 * startup/reset and never mutated mid-run, which is what makes "same config in ⇒ same result out"
 * hold. {@code demandProfile}/{@code demandMultiplier} configure passenger demand generation (see
 * {@code PassengerDemandGenerationHandler}): {@code demandProfile} selects which named regime
 * governs arrival rates (or {@code AUTO} to derive one from the simulated clock's hour of day —
 * see {@link DemandProfile#resolve}); {@code demandMultiplier} is an extra global scale applied on
 * top of that (and, for {@code CUSTOM}, the *only* scale — see {@link DemandProfile}).
 */
public record EngineSettings(
        int baseSimSecondsPerTick,
        int minHeadwaySeconds,
        int delayThresholdSeconds,
        long randomSeed,
        DemandProfile demandProfile,
        double demandMultiplier
) {

    /** Convenience constructor for call sites (mostly tests) that don't care about passenger
     * demand and just want the engine's train-movement behaviour — defaults to {@code AUTO} at a
     * neutral 1.0x multiplier. */
    public EngineSettings(int baseSimSecondsPerTick, int minHeadwaySeconds, int delayThresholdSeconds,
                           long randomSeed) {
        this(baseSimSecondsPerTick, minHeadwaySeconds, delayThresholdSeconds, randomSeed, DemandProfile.AUTO, 1.0);
    }

    /** Simulated seconds a single tick represents at the given speed. */
    public long deltaSecondsFor(SimulationSpeed speed) {
        return Math.round(baseSimSecondsPerTick * speed.multiplier());
    }
}
