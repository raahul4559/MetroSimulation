package com.nammametro.simulation.trainsim.domain.model;

import java.util.List;

/** Everything {@code GET /api/simulation/state} answers with: the clock, and every train's position. */
public record SimulationState(SimulationClock clock, List<TrainState> trains) {

    public SimulationState withClock(SimulationClock newClock) {
        return new SimulationState(newClock, trains);
    }

    public SimulationState withTrains(List<TrainState> newTrains) {
        return new SimulationState(clock, newTrains);
    }
}
