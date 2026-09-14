package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.domain.model.Interchange;

import java.util.List;

public record InterchangeResponse(StationResponse station, List<LineSummaryResponse> connectedLines) {

    public static InterchangeResponse from(Interchange interchange) {
        return new InterchangeResponse(
                StationResponse.from(interchange.station()),
                interchange.connectedLines().stream().map(LineSummaryResponse::from).toList()
        );
    }
}
