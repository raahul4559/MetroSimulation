package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.TrainState;

public record TrainStateResponse(
        long id,
        String code,
        String lineCode,
        String direction,
        Long currentTrackId,
        long previousStationId,
        long nextStationId,
        double progress,
        double speedKmph,
        String status,
        int passengerCount,
        int capacity
) {

    public static TrainStateResponse from(TrainState train) {
        return new TrainStateResponse(
                train.id(),
                train.code(),
                train.lineCode(),
                train.direction().name(),
                train.currentTrackId(),
                train.previousStationId(),
                train.nextStationId(),
                train.progress(),
                train.speedKmph(),
                train.status().name(),
                train.passengerCount(),
                train.capacity()
        );
    }
}
