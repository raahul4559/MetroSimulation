package com.nammametro.simulation.infrastructure.persistence.mapper;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.Station;
import com.nammametro.simulation.infrastructure.persistence.entity.StationJpaEntity;

public final class StationMapper {

    private StationMapper() {
    }

    public static Station toDomain(StationJpaEntity entity) {
        return new Station(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                new Coordinates(entity.getLatitude(), entity.getLongitude()),
                entity.isInterchange(),
                entity.getPlatformCount()
        );
    }
}
