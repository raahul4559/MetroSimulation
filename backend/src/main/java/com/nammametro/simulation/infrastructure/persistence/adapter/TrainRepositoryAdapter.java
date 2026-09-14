package com.nammametro.simulation.infrastructure.persistence.adapter;

import com.nammametro.simulation.application.port.out.TrainRepository;
import com.nammametro.simulation.domain.model.Train;
import com.nammametro.simulation.infrastructure.persistence.mapper.TrainMapper;
import com.nammametro.simulation.infrastructure.persistence.repository.TrainJpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
@Transactional(readOnly = true)
public class TrainRepositoryAdapter implements TrainRepository {

    private final TrainJpaRepository jpaRepository;

    public TrainRepositoryAdapter(TrainJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public List<Train> findAll() {
        return jpaRepository.findAll().stream().map(TrainMapper::toDomain).toList();
    }
}
