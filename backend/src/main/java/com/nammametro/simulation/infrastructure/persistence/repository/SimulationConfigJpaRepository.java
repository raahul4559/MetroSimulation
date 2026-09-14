package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.SimulationConfigJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SimulationConfigJpaRepository extends JpaRepository<SimulationConfigJpaEntity, Long> {

    Optional<SimulationConfigJpaEntity> findByActiveTrue();
}
