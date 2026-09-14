package com.nammametro.simulation.domain.model;

public record SimulationConfig(
        Long id,
        String name,
        int tickIntervalMs,
        double timeScale,
        int dwellTimeSeconds,
        int headwaySeconds,
        boolean active
) {
}
