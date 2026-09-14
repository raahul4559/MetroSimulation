package com.nammametro.simulation.domain.model;

import java.time.Instant;

/**
 * {@code timeScale} doubles as the default simulation speed multiplier and {@code headwaySeconds}
 * as the minimum headway between trains — both consumed by the discrete-time simulation engine
 * ({@code com.nammametro.simulation.trainsim}) alongside the newer fields added for it.
 */
public record SimulationConfig(
        Long id,
        String name,
        int tickIntervalMs,
        double timeScale,
        int dwellTimeSeconds,
        int headwaySeconds,
        boolean active,
        Instant startTime,
        int baseSimSecondsPerTick,
        int delayThresholdSeconds,
        long randomSeed
) {
}
