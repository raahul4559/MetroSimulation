package com.nammametro.simulation.metro.infrastructure.loader.raw;

import java.util.List;

/** Deserialization target for one entry in {@code data/metro/tracks.json}. {@code geometry} may be absent. */
public record RawTrack(
        long id,
        String lineCode,
        String fromStationCode,
        String toStationCode,
        int distanceMetres,
        int expectedTravelTimeSeconds,
        List<RawCoordinates> geometry
) {
}
