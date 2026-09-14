package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.StationJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StationJpaRepository extends JpaRepository<StationJpaEntity, Long> {

    Optional<StationJpaEntity> findByCode(String code);
}
