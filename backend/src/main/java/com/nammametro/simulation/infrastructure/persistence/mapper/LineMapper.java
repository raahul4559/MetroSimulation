package com.nammametro.simulation.infrastructure.persistence.mapper;

import com.nammametro.simulation.domain.model.Line;
import com.nammametro.simulation.domain.model.LineStatus;
import com.nammametro.simulation.domain.model.Station;
import com.nammametro.simulation.infrastructure.persistence.entity.LineJpaEntity;

import java.util.List;

public final class LineMapper {

    private LineMapper() {
    }

    public static Line toDomain(LineJpaEntity entity, List<Station> orderedStations) {
        return new Line(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getColourHex(),
                LineStatus.valueOf(entity.getStatus()),
                orderedStations
        );
    }
}
