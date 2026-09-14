package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.util.List;

public record SimulationStateResponse(
        SimulationClockResponse clock,
        List<TrainStateResponse> trains,
        List<SignalResponse> signals,
        List<PassengerResponse> passengers,
        PassengerMetricsResponse passengerMetrics,
        List<DisruptionResponse> disruptions
) {

    public static SimulationStateResponse from(SimulationState state) {
        return new SimulationStateResponse(
                SimulationClockResponse.from(state.clock()),
                state.trains().stream().map(TrainStateResponse::from).toList(),
                state.signals().stream().map(SignalResponse::from).toList(),
                state.passengers().stream().map(PassengerResponse::from).toList(),
                PassengerMetricsResponse.from(state.passengerMetrics()),
                state.disruptions().stream().map(DisruptionResponse::from).toList()
        );
    }
}
