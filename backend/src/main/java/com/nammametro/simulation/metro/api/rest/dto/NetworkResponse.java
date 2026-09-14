package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.network.MetroNetwork;

import java.util.List;

public record NetworkResponse(
        List<StationResponse> stations,
        List<LineResponse> lines,
        List<TrackResponse> tracks,
        List<InterchangeResponse> interchanges
) {

    public static NetworkResponse from(MetroNetwork network) {
        return new NetworkResponse(
                network.allStations().stream().map(StationResponse::from).toList(),
                network.allLines().stream().map(LineResponse::from).toList(),
                network.allTracks().stream().map(TrackResponse::from).toList(),
                network.getInterchanges().stream().map(InterchangeResponse::from).toList()
        );
    }
}
