package com.nammametro.simulation.infrastructure.persistence.adapter;

import com.nammametro.simulation.application.port.out.TrackRepository;
import com.nammametro.simulation.domain.model.Track;
import com.nammametro.simulation.infrastructure.persistence.mapper.TrackMapper;
import com.nammametro.simulation.infrastructure.persistence.repository.TrackJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
@Transactional(readOnly = true)
public class TrackRepositoryAdapter implements TrackRepository {

    private final TrackJpaRepository jpaRepository;

    public TrackRepositoryAdapter(TrackJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public List<Track> findAll() {
        return jpaRepository.findAll().stream().map(TrackMapper::toDomain).toList();
    }

    @Override
    public List<Track> findByLineId(Long lineId) {
        return jpaRepository.findByLineId(lineId).stream().map(TrackMapper::toDomain).toList();
    }
}
