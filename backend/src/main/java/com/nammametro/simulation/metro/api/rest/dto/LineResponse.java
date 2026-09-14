package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.domain.model.Line;

import java.util.List;

public record LineResponse(long id, String code, String name, String colorHex, List<StationResponse> stations) {

    public static LineResponse from(Line line) {
        return new LineResponse(
                line.id(),
                line.code(),
                line.name(),
                line.colorHex(),
                line.orderedStations().stream().map(StationResponse::from).toList()
        );
    }
}
