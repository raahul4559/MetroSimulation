package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

public interface TrainSimulationControlUseCase {

    SimulationState getState();

    SimulationClock getClock();

    SimulationState start();

    SimulationState pause();

    SimulationState stop();

    SimulationState reset();

    SimulationState setSpeed(SimulationSpeed speed);
}
