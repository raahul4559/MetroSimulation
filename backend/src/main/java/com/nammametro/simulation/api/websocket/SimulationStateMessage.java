package com.nammametro.simulation.api.websocket;

import com.nammametro.simulation.domain.model.Simulation;

/** Wire format broadcast on {@code /topic/simulation}. */
public record SimulationStateMessage(
        String status,
        long currentTick,
        long elapsedSimulationMs
) {

    public static SimulationStateMessage from(Simulation simulation) {
        return new SimulationStateMessage(
                simulation.status().name(),
                simulation.currentTick(),
                simulation.elapsedSimulationTime().toMillis()
        );
    }
}
