package com.nammametro.simulation.metro.domain.model;

import com.nammametro.simulation.domain.model.Coordinates;

import java.util.List;

/**
 * An undirected edge between two adjacent stations. {@code geometry} is an optional polyline
 * (empty when not available, as in the bundled dataset) — a future geographic renderer would use
 * it in place of a straight line between the two stations.
 */
public record Track(
        long id,
        String lineCode,
        long fromStationId,
        long toStationId,
        int distanceMetres,
        int expectedTravelTimeSeconds,
        List<Coordinates> geometry
) {

    /** The station at the other end of this edge from {@code stationId}. */
    public long otherEndpoint(long stationId) {
        return fromStationId == stationId ? toStationId : fromStationId;
    }
}
