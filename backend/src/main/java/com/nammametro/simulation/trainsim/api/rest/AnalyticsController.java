package com.nammametro.simulation.trainsim.api.rest;

import com.nammametro.simulation.trainsim.analytics.AnalyticsRange;
import com.nammametro.simulation.trainsim.analytics.AnalyticsService;
import com.nammametro.simulation.trainsim.api.rest.dto.analytics.AnalyticsResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * The analytics dashboard's single read endpoint. {@code range} selects what
 * {@code simulationResult}/{@code historical} are scoped to ({@code live} is always "now," see
 * {@link AnalyticsService}); {@code from}/{@code to} (ISO-8601 instants) are required only for
 * {@code range=CUSTOM} and ignored otherwise.
 */
@RestController
@RequestMapping("/api/simulation/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping
    public AnalyticsResponse getAnalytics(
            @RequestParam(defaultValue = "FULL") AnalyticsRange range,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return analyticsService.compute(range, from, to);
    }
}
