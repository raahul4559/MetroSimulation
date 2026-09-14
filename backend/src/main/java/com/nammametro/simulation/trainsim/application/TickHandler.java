package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.trainsim.domain.model.SimulationState;

/**
 * One stage of the tick pipeline. Pure function of {@code (current, context)} — no wall-clock
 * reads, no I/O — which is what makes the engine's output a deterministic function of its inputs.
 */
public interface TickHandler {

    TickResult handle(SimulationState current, TickContext context);
}
