package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.util.List;

/** Outbound port for broadcasting simulation state/events. Implemented by the WebSocket adapter. */
public interface TrainSimulationEventPublisher {

    void publishState(SimulationState state);

    void publishEvents(List<SimulationEvent> events);
}
