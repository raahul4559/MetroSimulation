package com.nammametro.simulation.metro.domain.exception;

public class RouteNotFoundException extends RuntimeException {

    public RouteNotFoundException(long fromStationId, long toStationId) {
        super("No route exists between station %d and station %d".formatted(fromStationId, toStationId));
    }
}
