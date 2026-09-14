package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.trainsim.domain.model.AffectedResourceType;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure delay/impact rollup over a {@link SimulationState} snapshot — no state of its own, same
 * convention as {@code BlockSafetyValidator}. "Affected" trains are simply every train currently
 * running behind schedule ({@code delaySeconds() > 0}); "affected passengers" adds the riders
 * onboard those trains to everyone currently waiting/transferring at a station an {@code ACTIVE}
 * disruption targets — a reasonable proxy for passenger impact, not a claim to trace every rider a
 * disruption could plausibly delay.
 */
public final class DisruptionAnalyticsService {

    private DisruptionAnalyticsService() {
    }

    public static Analytics compute(SimulationState state) {
        List<TrainState> trains = state.trains();
        List<TrainState> affectedTrains = trains.stream().filter(t -> t.delaySeconds() > 0).toList();

        long totalDelaySeconds = trains.stream().mapToLong(TrainState::delaySeconds).sum();
        double averageDelaySeconds = trains.isEmpty() ? 0.0 : (double) totalDelaySeconds / trains.size();
        int maxDelaySeconds = trains.stream().mapToInt(TrainState::delaySeconds).max().orElse(0);

        Set<Long> disruptedStationIds = state.disruptions().stream()
                .filter(Disruption::isActive)
                .filter(d -> d.resourceType() == AffectedResourceType.STATION)
                .map(Disruption::resourceId)
                .collect(Collectors.toSet());

        int onboardAffectedTrains = affectedTrains.stream().mapToInt(TrainState::passengerCount).sum();
        long waitingAtDisruptedStations = state.passengers().stream()
                .filter(p -> p.currentStationId() != null && disruptedStationIds.contains(p.currentStationId()))
                .filter(p -> p.status() == PassengerStatus.WAITING || p.status() == PassengerStatus.TRANSFER)
                .count();

        return new Analytics(totalDelaySeconds, averageDelaySeconds, maxDelaySeconds, affectedTrains.size(),
                onboardAffectedTrains + (int) waitingAtDisruptedStations);
    }

    public record Analytics(long totalDelaySeconds, double averageDelaySeconds, int maxDelaySeconds,
                             int affectedTrainsCount, int affectedPassengers) {
    }
}
