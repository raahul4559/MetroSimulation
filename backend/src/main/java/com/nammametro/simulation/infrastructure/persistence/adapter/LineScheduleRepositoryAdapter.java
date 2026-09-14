package com.nammametro.simulation.infrastructure.persistence.adapter;

import com.nammametro.simulation.application.port.out.LineScheduleRepository;
import com.nammametro.simulation.domain.model.LineSchedule;
import com.nammametro.simulation.infrastructure.persistence.mapper.LineScheduleMapper;
import com.nammametro.simulation.infrastructure.persistence.repository.LineScheduleJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
@Transactional(readOnly = true)
public class LineScheduleRepositoryAdapter implements LineScheduleRepository {

    private final LineScheduleJpaRepository jpaRepository;

    public LineScheduleRepositoryAdapter(LineScheduleJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public List<LineSchedule> findAll() {
        return jpaRepository.findAll().stream().map(LineScheduleMapper::toDomain).toList();
    }
}
