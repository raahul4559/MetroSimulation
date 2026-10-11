package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.util.List;

/**
 * Predicted (or, from {@code ScheduleProvider}, timetabled) arrival/departure times for a trip's
 * remaining stops — shaped after GTFS-Realtime's {@code TripUpdate}. {@code vehicleId} links it to
 * a {@link VehiclePosition} when the trip id alone doesn't.
 */
public record TripUpdate(
        String tripId,
        String routeId,
        Integer directionId,
        String vehicleId,
        List<StopTimeUpdate> stopTimeUpdates,
        Instant timestamp
) {

    public TripUpdate {
        stopTimeUpdates = stopTimeUpdates == null ? List.of() : List.copyOf(stopTimeUpdates);
    }

    /**
     * One stop's prediction. {@code delaySeconds} is null when the provider doesn't say — which is
     * not the same as on time, so it is never defaulted to zero.
     */
    public record StopTimeUpdate(
            String stopId,
            Integer stopSequence,
            Instant arrivalTime,
            Instant departureTime,
            Integer delaySeconds,
            boolean skipped
    ) {
    }
}
