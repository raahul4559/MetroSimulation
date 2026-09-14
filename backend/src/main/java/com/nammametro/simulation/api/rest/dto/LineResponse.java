package com.nammametro.simulation.api.rest.dto;

import com.nammametro.simulation.domain.model.Line;

import java.util.List;

public record LineResponse(
        Long id,
        String code,
        String name,
        String colourHex,
        String status,
        List<StationResponse> stations
) {

    public static LineResponse from(Line line) {
        return new LineResponse(
                line.id(),
                line.code(),
                line.name(),
                line.colourHex(),
                line.status().name(),
                line.orderedStations().stream().map(StationResponse::from).toList()
        );
    }
}
