package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.LineJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LineJpaRepository extends JpaRepository<LineJpaEntity, Long> {

    Optional<LineJpaEntity> findByCode(String code);
}
