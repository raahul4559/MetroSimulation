package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.TrainJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainJpaRepository extends JpaRepository<TrainJpaEntity, Long> {
}
