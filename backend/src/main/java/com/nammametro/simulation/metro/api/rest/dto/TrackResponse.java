package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.domain.model.Track;

import java.util.List;

public record TrackResponse(
        long id,
        String lineCode,
        long fromStationId,
        long toStationId,
        int distanceMetres,
        int expectedTravelTimeSeconds,
        List<GeometryPointResponse> geometry
) {

    public static TrackResponse from(Track track) {
        return new TrackResponse(
                track.id(),
                track.lineCode(),
                track.fromStationId(),
                track.toStationId(),
                track.distanceMetres(),
                track.expectedTravelTimeSeconds(),
                track.geometry().stream().map(GeometryPointResponse::from).toList()
        );
    }
}
