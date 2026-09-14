package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.domain.model.Station;

import java.util.List;

public record StationResponse(
        long id,
        String code,
        String name,
        double latitude,
        double longitude,
        List<String> lines,
        String stationType,
        int dwellTimeSeconds
) {

    public static StationResponse from(Station station) {
        return new StationResponse(
                station.id(),
                station.code(),
                station.name(),
                station.coordinates().latitude(),
                station.coordinates().longitude(),
                station.lineCodes(),
                station.type().name(),
                station.dwellTimeSeconds()
        );
    }
}
