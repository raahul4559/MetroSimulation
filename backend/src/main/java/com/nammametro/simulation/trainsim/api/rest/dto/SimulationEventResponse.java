package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;

public record SimulationEventResponse(
        long tick,
        String simulationTime,
        String type,
        long trainId,
        String trainCode,
        Long stationId,
        String message
) {

    public static SimulationEventResponse from(SimulationEvent event) {
        return new SimulationEventResponse(
                event.tick(),
                event.simulationTime().toString(),
                event.type().name(),
                event.trainId(),
                event.trainCode(),
                event.stationId(),
                event.message()
        );
    }
}
