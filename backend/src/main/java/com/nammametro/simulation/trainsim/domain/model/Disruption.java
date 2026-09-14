package com.nammametro.simulation.trainsim.domain.model;

/**
 * An operational disruption injected into the simulation — a broken-down train, a blocked track,
 * station congestion, etc. {@code resourceType}/{@code resourceId} identify what it targets:
 * {@code resourceType} is fixed by {@code type} (see {@link #resourceTypeFor}), never chosen
 * independently by a caller. {@code startSeconds}/{@code durationSeconds} are simulation-elapsed
 * seconds ({@code SimulationClock#elapsedSimulationSeconds}), the same basis every other duration
 * in this engine uses.
 *
 * <p>{@code magnitudeSeconds} only matters for {@code STATION_CONGESTION} (extra dwell added to
 * every train stopping at the station while active), {@code EXTENDED_DWELL} (extra dwell added to
 * the one targeted train), and {@code CUSTOM_DELAY} (unused — that type simply freezes its target
 * train for the whole active window, same as {@code TRAIN_FAILURE}). {@code TRACK_BLOCKAGE} and
 * {@code SIGNAL_FAILURE} fully block their track for the whole active window regardless of
 * magnitude.
 */
public record Disruption(
        long id,
        DisruptionType type,
        AffectedResourceType resourceType,
        long resourceId,
        long startSeconds,
        int durationSeconds,
        int magnitudeSeconds,
        DisruptionSeverity severity,
        String description,
        DisruptionStatus status
) {

    public long endSeconds() {
        return startSeconds + durationSeconds;
    }

    public boolean isActive() {
        return status == DisruptionStatus.ACTIVE;
    }

    public Disruption withStatus(DisruptionStatus newStatus) {
        return new Disruption(id, type, resourceType, resourceId, startSeconds, durationSeconds,
                magnitudeSeconds, severity, description, newStatus);
    }

    /** The resource kind every disruption of {@code type} targets — fixed, not a free choice. */
    public static AffectedResourceType resourceTypeFor(DisruptionType type) {
        return switch (type) {
            case TRAIN_FAILURE, EXTENDED_DWELL, CUSTOM_DELAY -> AffectedResourceType.TRAIN;
            case TRACK_BLOCKAGE, SIGNAL_FAILURE -> AffectedResourceType.TRACK;
            case STATION_CONGESTION -> AffectedResourceType.STATION;
        };
    }
}
