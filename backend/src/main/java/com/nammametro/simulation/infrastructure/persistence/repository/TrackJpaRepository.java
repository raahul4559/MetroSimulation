package com.nammametro.simulation.infrastructure.persistence.repository;

import com.nammametro.simulation.infrastructure.persistence.entity.TrackJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TrackJpaRepository extends JpaRepository<TrackJpaEntity, Long> {

    List<TrackJpaEntity> findByLineId(Long lineId);
}
