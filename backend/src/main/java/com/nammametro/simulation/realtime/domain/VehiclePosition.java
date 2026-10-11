package com.nammametro.simulation.realtime.domain;

import java.time.Instant;

/**
 * One vehicle as a provider reported it, in the provider's own identifiers — shaped after
 * GTFS-Realtime's {@code VehiclePosition}, the most likely format for any authorized feed. Nothing
 * here is mapped onto the network yet; {@code FeedNormalizer} does that, and rejects what it can't
 * place.
 *
 * <p>Everything except {@code vehicleId} is optional (nullable), because real feeds omit fields:
 * {@code stopId} may be absent, {@code latitude}/{@code longitude} may be absent, and so on.
 * {@code timestamp} is when the provider says the position was measured, not when we fetched it.
 */
public record VehiclePosition(
        String vehicleId,
        String vehicleLabel,
        String tripId,
        String routeId,
        Integer directionId,
        String stopId,
        VehicleStopStatus currentStatus,
        Double latitude,
        Double longitude,
        Double bearingDegrees,
        Double speedMetresPerSecond,
        Instant timestamp
) {

    public boolean hasCoordinates() {
        return latitude != null && longitude != null;
    }
}
