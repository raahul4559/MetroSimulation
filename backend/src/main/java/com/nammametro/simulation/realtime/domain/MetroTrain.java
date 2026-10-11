package com.nammametro.simulation.realtime.domain;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Instant;

/**
 * The canonical train: one shape for every {@link DataSource}, so the 2D map, the 3D station,
 * arrival boards and announcements read exactly one model regardless of where a position came from.
 *
 * <p>The position fields ({@code previousStationId}/{@code nextStationId}/{@code currentTrackId}/
 * {@code progress}/{@code status}) follow {@link TrainState}'s conventions exactly — a train at a
 * platform has {@code previousStationId == nextStationId}, {@code progress} runs 0..1 along
 * {@code currentTrackId} — so the existing frontend derivations need no per-source branches.
 *
 * <p>Fields a source can't know are null rather than a plausible-looking zero: a GTFS feed doesn't
 * report passenger counts, a timetable doesn't know delays, and "0 passengers" or "on time" would
 * both be fabrications. The block from {@code scheduledDepartureSeconds} to
 * {@code actualDepartureSeconds} is simulation-only bookkeeping (simulation-elapsed seconds) and is
 * null for every other source.
 *
 * <p>Provenance: {@code source} says where this came from; {@code observedAt} is when that source
 * last placed the train (provider measurement time, not our fetch time); {@code stale} is true once
 * that is older than the configured threshold; {@code positionEstimated} is true when the position
 * shown was extrapolated forward from {@code observedAt} rather than reported as-is.
 */
public record MetroTrain(
        long id,
        String code,
        String lineCode,
        TrainDirection direction,
        Long currentTrackId,
        long previousStationId,
        long nextStationId,
        double progress,
        Double speedKmph,
        TrainStatus status,
        Integer passengerCount,
        Integer capacity,
        Integer delaySeconds,
        Instant nextStationEta,
        Coordinates position,
        Long scheduledDepartureSeconds,
        Integer dwellTimeSeconds,
        Double maxSpeedKmph,
        Double accelerationMps2,
        Double brakingRateMps2,
        Integer scheduledArrivalSeconds,
        Integer actualArrivalSeconds,
        Integer actualDepartureSeconds,
        DataSource source,
        String vehicleId,
        String tripId,
        Instant observedAt,
        boolean stale,
        boolean positionEstimated
) {

    /** A simulated train, losslessly — every simulation-only field carried through as-is. The
     * simulation is its own ground truth, so it is never stale or estimated. */
    public static MetroTrain fromSimulation(TrainState train, Instant observedAt) {
        return new MetroTrain(
                train.id(), train.code(), train.lineCode(), train.direction(), train.currentTrackId(),
                train.previousStationId(), train.nextStationId(), train.progress(), train.speedKmph(),
                train.status(), train.passengerCount(), train.capacity(), train.delaySeconds(), null, null,
                train.scheduledDepartureSeconds(), train.dwellTimeSeconds(), train.maxSpeedKmph(),
                train.accelerationMps2(), train.brakingRateMps2(), train.scheduledArrivalSeconds(),
                train.actualArrivalSeconds(), train.actualDepartureSeconds(),
                DataSource.SIMULATION, train.code(), null, observedAt, false, false);
    }

    public MetroTrain withId(long newId) {
        return new MetroTrain(newId, code, lineCode, direction, currentTrackId, previousStationId, nextStationId,
                progress, speedKmph, status, passengerCount, capacity, delaySeconds, nextStationEta, position,
                scheduledDepartureSeconds, dwellTimeSeconds, maxSpeedKmph, accelerationMps2, brakingRateMps2,
                scheduledArrivalSeconds, actualArrivalSeconds, actualDepartureSeconds, source, vehicleId, tripId,
                observedAt, stale, positionEstimated);
    }

    public MetroTrain withProgress(double newProgress, boolean estimated) {
        return new MetroTrain(id, code, lineCode, direction, currentTrackId, previousStationId, nextStationId,
                newProgress, speedKmph, status, passengerCount, capacity, delaySeconds, nextStationEta, position,
                scheduledDepartureSeconds, dwellTimeSeconds, maxSpeedKmph, accelerationMps2, brakingRateMps2,
                scheduledArrivalSeconds, actualArrivalSeconds, actualDepartureSeconds, source, vehicleId, tripId,
                observedAt, stale, estimated);
    }

    public MetroTrain withStale(boolean newStale) {
        return new MetroTrain(id, code, lineCode, direction, currentTrackId, previousStationId, nextStationId,
                progress, speedKmph, status, passengerCount, capacity, delaySeconds, nextStationEta, position,
                scheduledDepartureSeconds, dwellTimeSeconds, maxSpeedKmph, accelerationMps2, brakingRateMps2,
                scheduledArrivalSeconds, actualArrivalSeconds, actualDepartureSeconds, source, vehicleId, tripId,
                observedAt, newStale, positionEstimated);
    }

    /** Stable identity across fetches: the same physical vehicle (or timetabled trip) keeps the
     * same numeric {@link #id} for as long as it keeps appearing. */
    public String identityKey() {
        return source.name() + ":" + (vehicleId != null ? vehicleId : tripId);
    }
}
