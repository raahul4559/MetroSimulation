package com.nammametro.simulation.infrastructure.persistence.mapper;

import com.nammametro.simulation.domain.model.SimulationConfig;
import com.nammametro.simulation.infrastructure.persistence.entity.SimulationConfigJpaEntity;

public final class SimulationConfigMapper {

    private SimulationConfigMapper() {
    }

    public static SimulationConfig toDomain(SimulationConfigJpaEntity entity) {
        return new SimulationConfig(
                entity.getId(),
                entity.getName(),
                entity.getTickIntervalMs(),
                entity.getTimeScale(),
                entity.getDwellTimeSeconds(),
                entity.getHeadwaySeconds(),
                entity.isActive(),
                entity.getStartTime(),
                entity.getBaseSimSecondsPerTick(),
                entity.getDelayThresholdSeconds(),
                entity.getRandomSeed()
        );
    }
}
