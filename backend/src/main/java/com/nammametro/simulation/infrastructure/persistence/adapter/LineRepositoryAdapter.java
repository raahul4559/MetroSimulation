package com.nammametro.simulation.infrastructure.persistence.adapter;

import com.nammametro.simulation.application.port.out.LineRepository;
import com.nammametro.simulation.domain.model.Line;
import com.nammametro.simulation.domain.model.Station;
import com.nammametro.simulation.infrastructure.persistence.entity.LineJpaEntity;
import com.nammametro.simulation.infrastructure.persistence.entity.LineStationJpaEntity;
import com.nammametro.simulation.infrastructure.persistence.mapper.LineMapper;
import com.nammametro.simulation.infrastructure.persistence.mapper.StationMapper;
import com.nammametro.simulation.infrastructure.persistence.repository.LineJpaRepository;
import com.nammametro.simulation.infrastructure.persistence.repository.LineStationJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
@Transactional(readOnly = true)
public class LineRepositoryAdapter implements LineRepository {

    private final LineJpaRepository lineJpaRepository;
    private final LineStationJpaRepository lineStationJpaRepository;

    public LineRepositoryAdapter(LineJpaRepository lineJpaRepository,
                                  LineStationJpaRepository lineStationJpaRepository) {
        this.lineJpaRepository = lineJpaRepository;
        this.lineStationJpaRepository = lineStationJpaRepository;
    }

    @Override
    public List<Line> findAll() {
        return lineJpaRepository.findAll().stream().map(this::toDomainWithStations).toList();
    }

    @Override
    public Optional<Line> findByCode(String code) {
        return lineJpaRepository.findByCode(code).map(this::toDomainWithStations);
    }

    private Line toDomainWithStations(LineJpaEntity entity) {
        List<Station> orderedStations = lineStationJpaRepository
                .findByLineIdOrderBySequenceNoAsc(entity.getId())
                .stream()
                .map(LineStationJpaEntity::getStation)
                .map(StationMapper::toDomain)
                .toList();
        return LineMapper.toDomain(entity, orderedStations);
    }
}
