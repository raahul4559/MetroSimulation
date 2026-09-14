package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.application.DisruptionAnalyticsService;

public record DisruptionAnalyticsResponse(
        long totalDelaySeconds,
        double averageDelaySeconds,
        int maxDelaySeconds,
        int affectedTrainsCount,
        int affectedPassengers
) {

    public static DisruptionAnalyticsResponse from(DisruptionAnalyticsService.Analytics analytics) {
        return new DisruptionAnalyticsResponse(
                analytics.totalDelaySeconds(),
                analytics.averageDelaySeconds(),
                analytics.maxDelaySeconds(),
                analytics.affectedTrainsCount(),
                analytics.affectedPassengers()
        );
    }
}
