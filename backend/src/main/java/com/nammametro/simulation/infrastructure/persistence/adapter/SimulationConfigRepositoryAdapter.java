package com.nammametro.simulation.infrastructure.persistence.adapter;

import com.nammametro.simulation.application.port.out.SimulationConfigRepository;
import com.nammametro.simulation.domain.model.SimulationConfig;
import com.nammametro.simulation.infrastructure.persistence.mapper.SimulationConfigMapper;
import com.nammametro.simulation.infrastructure.persistence.repository.SimulationConfigJpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class SimulationConfigRepositoryAdapter implements SimulationConfigRepository {

    private final SimulationConfigJpaRepository jpaRepository;

    public SimulationConfigRepositoryAdapter(SimulationConfigJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<SimulationConfig> findActive() {
        return jpaRepository.findByActiveTrue().map(SimulationConfigMapper::toDomain);
    }
}
