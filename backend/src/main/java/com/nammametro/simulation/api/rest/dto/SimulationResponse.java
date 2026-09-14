package com.nammametro.simulation.api.rest.dto;

import com.nammametro.simulation.domain.model.Simulation;

public record SimulationResponse(
        String status,
        long currentTick,
        long elapsedSimulationMs,
        int tickIntervalMs,
        double timeScale
) {

    public static SimulationResponse from(Simulation simulation) {
        return new SimulationResponse(
                simulation.status().name(),
                simulation.currentTick(),
                simulation.elapsedSimulationTime().toMillis(),
                simulation.config().tickIntervalMs(),
                simulation.config().timeScale()
        );
    }
}
