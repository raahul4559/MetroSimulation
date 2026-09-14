package com.nammametro.simulation.infrastructure.persistence.adapter;

import com.nammametro.simulation.application.port.out.StationRepository;
import com.nammametro.simulation.domain.model.Station;
import com.nammametro.simulation.infrastructure.persistence.mapper.StationMapper;
import com.nammametro.simulation.infrastructure.persistence.repository.StationJpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class StationRepositoryAdapter implements StationRepository {

    private final StationJpaRepository jpaRepository;

    public StationRepositoryAdapter(StationJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public List<Station> findAll() {
        return jpaRepository.findAll().stream().map(StationMapper::toDomain).toList();
    }

    @Override
    public Optional<Station> findByCode(String code) {
        return jpaRepository.findByCode(code).map(StationMapper::toDomain);
    }
}
