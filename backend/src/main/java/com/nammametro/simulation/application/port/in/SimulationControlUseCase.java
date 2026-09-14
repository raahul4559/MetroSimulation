package com.nammametro.simulation.application.port.in;

import com.nammametro.simulation.domain.model.Simulation;

public interface SimulationControlUseCase {

    Simulation getState();

    Simulation start();

    Simulation pause();

    Simulation reset();
}
