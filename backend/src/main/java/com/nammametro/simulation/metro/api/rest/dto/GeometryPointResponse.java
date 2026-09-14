package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.domain.model.Coordinates;

public record GeometryPointResponse(double latitude, double longitude) {

    public static GeometryPointResponse from(Coordinates coordinates) {
        return new GeometryPointResponse(coordinates.latitude(), coordinates.longitude());
    }
}
