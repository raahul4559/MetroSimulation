package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.Signal;

public record SignalResponse(
        String id,
        long trackId,
        long protectedSectionId,
        String blockState,
        String aspect,
        Long controllingTrainId
) {

    public static SignalResponse from(Signal signal) {
        return new SignalResponse(
                signal.id(),
                signal.trackId(),
                signal.protectedSectionId(),
                signal.blockState().name(),
                signal.aspect().name(),
                signal.controllingTrainId()
        );
    }
}
