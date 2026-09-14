package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;

public record PassengerMetricsResponse(
        long totalGenerated,
        long totalServed,
        long totalUnableToBoard,
        double averageWaitSeconds,
        double averageTravelSeconds,
        double averageJourneySeconds
) {

    public static PassengerMetricsResponse from(PassengerMetrics metrics) {
        return new PassengerMetricsResponse(
                metrics.totalGenerated(),
                metrics.totalServed(),
                metrics.totalUnableToBoard(),
                metrics.averageWaitSeconds(),
                metrics.averageTravelSeconds(),
                metrics.averageJourneySeconds()
        );
    }
}
