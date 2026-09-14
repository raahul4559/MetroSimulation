package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.routing.Route;

import java.util.List;

public record RouteResponse(
        List<StationResponse> stations,
        List<TrackResponse> tracks,
        int totalDistanceMetres,
        int totalTravelTimeSeconds
) {

    public static RouteResponse from(Route route) {
        return new RouteResponse(
                route.stations().stream().map(StationResponse::from).toList(),
                route.tracks().stream().map(TrackResponse::from).toList(),
                route.totalDistanceMetres(),
                route.totalTravelTimeSeconds()
        );
    }
}
