package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.LineScheduleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LineScheduleJpaRepository extends JpaRepository<LineScheduleJpaEntity, Long> {
}
