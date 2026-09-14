package com.nammametro.simulation.infrastructure.persistence.mapper;

import com.nammametro.simulation.domain.model.Train;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.domain.model.TrainStatus;
import com.nammametro.simulation.infrastructure.persistence.entity.TrainJpaEntity;

public final class TrainMapper {

    private TrainMapper() {
    }

    public static Train toDomain(TrainJpaEntity entity) {
        return new Train(
                entity.getId(),
                entity.getCode(),
                entity.getLine().getId(),
                entity.getLine().getCode(),
                entity.getCapacity(),
                TrainStatus.valueOf(entity.getStatus()),
                entity.getCurrentTrack() != null ? entity.getCurrentTrack().getId() : null,
                TrainDirection.valueOf(entity.getDirection())
        );
    }
}
