package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.Disruption;

public record DisruptionResponse(
        long id,
        String type,
        String resourceType,
        long resourceId,
        long startSeconds,
        int durationSeconds,
        long endSeconds,
        int magnitudeSeconds,
        String severity,
        String description,
        String status
) {

    public static DisruptionResponse from(Disruption disruption) {
        return new DisruptionResponse(
                disruption.id(),
                disruption.type().name(),
                disruption.resourceType().name(),
                disruption.resourceId(),
                disruption.startSeconds(),
                disruption.durationSeconds(),
                disruption.endSeconds(),
                disruption.magnitudeSeconds(),
                disruption.severity().name(),
                disruption.description(),
                disruption.status().name()
        );
    }
}
