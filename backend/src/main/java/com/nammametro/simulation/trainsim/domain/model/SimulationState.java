package com.nammametro.simulation.trainsim.domain.model;

import java.util.List;

/**
 * Everything {@code GET /api/simulation/state} answers with: the clock, every train's position,
 * and every block's signal. {@code signals} is fully derived from {@code trains} + the network
 * topology (see {@code TrainMovementTickHandler}) — not independent state, just like
 * {@code TrainState} itself is derived fresh each tick rather than mutated in place.
 */
public record SimulationState(SimulationClock clock, List<TrainState> trains, List<Signal> signals) {

    public SimulationState withClock(SimulationClock newClock) {
        return new SimulationState(newClock, trains, signals);
    }

    public SimulationState withTrains(List<TrainState> newTrains) {
        return new SimulationState(clock, newTrains, signals);
    }

    public SimulationState withSignals(List<Signal> newSignals) {
        return new SimulationState(clock, trains, newSignals);
    }
}
