package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.Simulation;

/** Outbound port for broadcasting simulation state. Implemented by the WebSocket adapter. */
public interface SimulationEventPublisher {

    void publish(Simulation simulation);
}
