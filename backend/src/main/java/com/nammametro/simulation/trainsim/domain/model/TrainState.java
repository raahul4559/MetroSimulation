package com.nammametro.simulation.trainsim.domain.model;

import com.nammametro.simulation.domain.model.TrainDirection;

/**
 * A train's runtime position and status — replaced wholesale each tick, never mutated in place.
 *
 * <p>{@code previousStationId} is where the train most recently departed from (or is currently
 * dwelling at, or — while {@link TrainStatus#SCHEDULED} — will start from); {@code nextStationId}
 * is where it's headed next (or, once {@link TrainStatus#COMPLETED}, equal to
 * {@code previousStationId} — there's nowhere further to go). {@code currentTrackId} is only
 * non-null while {@link TrainStatus#DEPARTING}, {@link TrainStatus#RUNNING}, or
 * {@link TrainStatus#ARRIVING}. {@code progress} runs 0 (just departed) to 1 (arrived) along that
 * track — trains are never teleported between the two.
 *
 * <p>{@code scheduledDepartureSeconds}, {@code dwellTimeSeconds}, {@code maxSpeedKmph},
 * {@code accelerationMps2}, and {@code brakingRateMps2} are the per-train configuration a
 * {@code LineSchedule} generated this train with (see {@code trainsim.infrastructure.LineScheduleAssembler});
 * they never change after spawn. {@code speedKmph} is the train's actual current speed (real
 * momentum carried tick-to-tick while {@link TrainStatus#RUNNING}, derived from {@code maxSpeedKmph}/
 * {@code accelerationMps2}/{@code brakingRateMps2} by {@code TrainMovementTickHandler}), not a
 * flat distance-over-time average.
 *
 * <p>{@code dwellRemainingSeconds} and {@code heldSeconds} are implementation state the tick
 * handler needs (dwell countdown; how long a train has been held for headway, i.e. its current
 * delay) — not part of the spec's literal field list, but required to make dwelling and headway
 * deterministic and resumable.
 */
public record TrainState(
        long id,
        String code,
        String lineCode,
        TrainDirection direction,
        Long currentTrackId,
        long previousStationId,
        long nextStationId,
        double progress,
        double speedKmph,
        TrainStatus status,
        int passengerCount,
        int capacity,
        int dwellRemainingSeconds,
        int heldSeconds,
        long scheduledDepartureSeconds,
        int dwellTimeSeconds,
        double maxSpeedKmph,
        double accelerationMps2,
        double brakingRateMps2
) {
}
