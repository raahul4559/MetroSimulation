package com.nammametro.simulation.api.rest.dto;

import com.nammametro.simulation.domain.model.Station;

public record StationResponse(
        Long id,
        String code,
        String name,
        double latitude,
        double longitude,
        boolean interchange,
        int platformCount
) {

    public static StationResponse from(Station station) {
        return new StationResponse(
                station.id(),
                station.code(),
                station.name(),
                station.coordinates().latitude(),
                station.coordinates().longitude(),
                station.interchange(),
                station.platformCount()
        );
    }
}
