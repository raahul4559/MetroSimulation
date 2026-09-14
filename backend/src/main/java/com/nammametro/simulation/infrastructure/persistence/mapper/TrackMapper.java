package com.nammametro.simulation.infrastructure.persistence.mapper;

import com.nammametro.simulation.domain.model.Direction;
import com.nammametro.simulation.domain.model.Track;
import com.nammametro.simulation.infrastructure.persistence.entity.TrackJpaEntity;

public final class TrackMapper {

    private TrackMapper() {
    }

    public static Track toDomain(TrackJpaEntity entity) {
        return new Track(
                entity.getId(),
                entity.getLine().getId(),
                entity.getFromStation().getId(),
                entity.getToStation().getId(),
                Direction.valueOf(entity.getDirection()),
                entity.getLengthM(),
                entity.getMaxSpeedKmph()
        );
    }
}
