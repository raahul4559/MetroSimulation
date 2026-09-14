package com.nammametro.simulation.domain.model;

public record Train(
        Long id,
        String code,
        Long lineId,
        int capacity,
        TrainStatus status,
        Long currentTrackId
) {
}
