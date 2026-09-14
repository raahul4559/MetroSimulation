package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.LineStationJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LineStationJpaRepository extends JpaRepository<LineStationJpaEntity, Long> {

    List<LineStationJpaEntity> findByLineIdOrderBySequenceNoAsc(Long lineId);
}
