package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.SimulationClock;

public record SimulationClockResponse(
        String startTime,
        String currentTime,
        String status,
        double speed,
        long currentTick,
        long elapsedSimulationSeconds
) {

    public static SimulationClockResponse from(SimulationClock clock) {
        return new SimulationClockResponse(
                clock.startTime().toString(),
                clock.currentTime().toString(),
                clock.status().name(),
                clock.speed().multiplier(),
                clock.currentTick(),
                clock.elapsedSimulationSeconds()
        );
    }
}
