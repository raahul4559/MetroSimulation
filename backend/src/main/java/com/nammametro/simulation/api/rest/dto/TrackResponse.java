package com.nammametro.simulation.api.rest.dto;

import com.nammametro.simulation.domain.model.Track;

public record TrackResponse(
        Long id,
        Long lineId,
        Long fromStationId,
        Long toStationId,
        String direction,
        int lengthMetres,
        int maxSpeedKmph
) {

    public static TrackResponse from(Track track) {
        return new TrackResponse(
                track.id(),
                track.lineId(),
                track.fromStationId(),
                track.toStationId(),
                track.direction().name(),
                track.lengthMetres(),
                track.maxSpeedKmph()
        );
    }
}
