package com.nammametro.simulation.application.service;

import com.nammametro.simulation.domain.model.Simulation;

/**
 * Extension seam for future simulation features (train movement, dwell timing, passenger
 * spawning, signalling). {@link SimulationEngine} runs every registered handler once per tick,
 * in order. No implementations exist yet in this foundation chunk.
 */
public interface TickHandler {

    Simulation handle(Simulation current);
}
