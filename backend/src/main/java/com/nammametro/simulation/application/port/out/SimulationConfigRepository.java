package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.SimulationConfig;

import java.util.Optional;

public interface SimulationConfigRepository {

    Optional<SimulationConfig> findActive();
}
