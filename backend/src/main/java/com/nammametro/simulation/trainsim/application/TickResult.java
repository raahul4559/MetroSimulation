package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.util.List;

public record TickResult(SimulationState state, List<SimulationEvent> events) {

    public static TickResult noEvents(SimulationState state) {
        return new TickResult(state, List.of());
    }
}
