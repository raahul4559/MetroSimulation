package com.nammametro.simulation.metro.api.rest.dto;

import com.nammametro.simulation.metro.domain.model.Line;

public record LineSummaryResponse(long id, String code, String name, String colorHex) {

    public static LineSummaryResponse from(Line line) {
        return new LineSummaryResponse(line.id(), line.code(), line.name(), line.colorHex());
    }
}
