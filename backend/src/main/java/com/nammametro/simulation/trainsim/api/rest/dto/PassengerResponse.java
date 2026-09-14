package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.Passenger;

import java.util.List;

public record PassengerResponse(
        long id,
        long originStationId,
        long destinationStationId,
        List<Long> route,
        Long currentStationId,
        Long currentTrainId,
        String status,
        long arrivalTimeSeconds,
        Long boardingTimeSeconds,
        Long completionTimeSeconds
) {

    public static PassengerResponse from(Passenger passenger) {
        return new PassengerResponse(
                passenger.id(),
                passenger.originStationId(),
                passenger.destinationStationId(),
                passenger.route(),
                passenger.currentStationId(),
                passenger.currentTrainId(),
                passenger.status().name(),
                passenger.arrivalTimeSeconds(),
                passenger.boardingTimeSeconds(),
                passenger.completionTimeSeconds()
        );
    }
}
