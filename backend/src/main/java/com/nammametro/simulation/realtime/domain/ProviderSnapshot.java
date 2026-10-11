package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.util.List;

/**
 * Everything one provider returned in one fetch. {@code feedTimestamp} is the provider's own
 * "generated at" (GTFS-Realtime's {@code FeedHeader.timestamp}) when it gives one, so a feed that
 * keeps answering but has stopped updating is still detectable as stale. {@code warnings} records
 * partial failures (e.g. the alerts endpoint failed but positions succeeded) without discarding
 * the parts that worked.
 */
public record ProviderSnapshot(
        List<VehiclePosition> vehiclePositions,
        List<TripUpdate> tripUpdates,
        List<ServiceAlert> serviceAlerts,
        Instant feedTimestamp,
        List<String> warnings
) {

    public ProviderSnapshot {
        vehiclePositions = vehiclePositions == null ? List.of() : List.copyOf(vehiclePositions);
        tripUpdates = tripUpdates == null ? List.of() : List.copyOf(tripUpdates);
        serviceAlerts = serviceAlerts == null ? List.of() : List.copyOf(serviceAlerts);
        warnings = warnings == null ? List.of() : List.copyOf(warnings);
    }
}
