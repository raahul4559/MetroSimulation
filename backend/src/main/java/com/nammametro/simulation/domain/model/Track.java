package com.nammametro.simulation.domain.model;

/** A directional segment of track between two adjacent stations on a line. */
public record Track(
        Long id,
        Long lineId,
        Long fromStationId,
        Long toStationId,
        Direction direction,
        int lengthMetres,
        int maxSpeedKmph
) {
}
