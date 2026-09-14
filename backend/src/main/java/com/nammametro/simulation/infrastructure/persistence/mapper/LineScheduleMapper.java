package com.nammametro.simulation.infrastructure.persistence.mapper;

import com.nammametro.simulation.domain.model.LineSchedule;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.infrastructure.persistence.entity.LineScheduleJpaEntity;

public final class LineScheduleMapper {

    private LineScheduleMapper() {
    }

    public static LineSchedule toDomain(LineScheduleJpaEntity entity) {
        return new LineSchedule(
                entity.getId(),
                entity.getLine().getId(),
                entity.getLine().getCode(),
                TrainDirection.valueOf(entity.getDirection()),
                entity.getFirstDepartureSeconds(),
                entity.getLastDepartureSeconds(),
                entity.getHeadwaySeconds(),
                entity.getTrainCount(),
                entity.getDwellTimeSeconds(),
                entity.getCapacity(),
                entity.getMaxSpeedKmph(),
                entity.getAccelerationMps2(),
                entity.getBrakingRateMps2()
        );
    }
}
