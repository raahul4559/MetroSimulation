package com.nammametro.simulation.trainsim.api.rest;

import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.api.rest.dto.CreateDisruptionRequest;
import com.nammametro.simulation.trainsim.api.rest.dto.DisruptionAnalyticsResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.DisruptionResponse;
import com.nammametro.simulation.trainsim.application.DisruptionAnalyticsService;
import com.nammametro.simulation.trainsim.application.DisruptionManagementUseCase;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import com.nammametro.simulation.trainsim.domain.model.AffectedResourceType;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.DisruptionType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/simulation")
public class DisruptionController {

    private final DisruptionManagementUseCase disruptions;
    private final TrainSimulationControlUseCase simulation;
    private final MetroNetwork network;

    public DisruptionController(DisruptionManagementUseCase disruptions, TrainSimulationControlUseCase simulation,
                                 MetroNetwork network) {
        this.disruptions = disruptions;
        this.simulation = simulation;
        this.network = network;
    }

    @GetMapping("/disruptions")
    public List<DisruptionResponse> getDisruptions() {
        return disruptions.listDisruptions().stream().map(DisruptionResponse::from).toList();
    }

    @PostMapping("/disruptions")
    public DisruptionResponse createDisruption(@RequestBody CreateDisruptionRequest request) {
        long resourceId = resolveResourceId(request);
        int magnitudeSeconds = request.magnitudeSeconds() != null
                ? request.magnitudeSeconds()
                : request.severity().defaultMagnitudeSeconds();
        String description = request.description() == null || request.description().isBlank()
                ? defaultDescription(request.type())
                : request.description();

        Disruption created = disruptions.createDisruption(request.type(), resourceId, request.durationSeconds(),
                request.severity(), magnitudeSeconds, description);
        return DisruptionResponse.from(created);
    }

    @DeleteMapping("/disruptions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelDisruption(@PathVariable long id) {
        boolean exists = disruptions.listDisruptions().stream().anyMatch(d -> d.id() == id);
        if (!exists) {
            throw new ResourceNotFoundException("Disruption", String.valueOf(id));
        }
        disruptions.cancelDisruption(id);
    }

    @GetMapping("/analytics/delays")
    public DisruptionAnalyticsResponse getDelayAnalytics() {
        return DisruptionAnalyticsResponse.from(DisruptionAnalyticsService.compute(simulation.getState()));
    }

    private long resolveResourceId(CreateDisruptionRequest request) {
        AffectedResourceType resourceType = Disruption.resourceTypeFor(request.type());
        if (resourceType == AffectedResourceType.TRACK) {
            if (request.fromStationId() == null || request.toStationId() == null) {
                throw new IllegalArgumentException(
                        "fromStationId and toStationId are required for " + request.type());
            }
            return network.getSingleTrackBetween(request.fromStationId(), request.toStationId())
                    .map(Track::id)
                    .orElseThrow(() -> new ResourceNotFoundException("Track between stations",
                            request.fromStationId() + "-" + request.toStationId()));
        }
        if (request.resourceId() == null) {
            throw new IllegalArgumentException("resourceId is required for " + request.type());
        }
        return request.resourceId();
    }

    private String defaultDescription(DisruptionType type) {
        return switch (type) {
            case TRAIN_FAILURE -> "Train failure";
            case SIGNAL_FAILURE -> "Signal failure";
            case STATION_CONGESTION -> "Station congestion";
            case TRACK_BLOCKAGE -> "Track blockage";
            case EXTENDED_DWELL -> "Extended dwell";
            case CUSTOM_DELAY -> "Manual delay";
        };
    }
}
