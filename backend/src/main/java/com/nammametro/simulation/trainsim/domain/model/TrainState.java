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
 * handler needs (dwell countdown; how long a train has been held for headway) — not part of the
 * spec's literal field list, but required to make dwelling and headway deterministic and
 * resumable.
 *
 * <p>{@code scheduledArrivalSeconds}/{@code actualArrivalSeconds} and
 * {@code scheduledDepartureSeconds}/{@code actualDepartureSeconds} are a nominal timetable
 * projected forward from nominal leg/dwell durations (see {@code TrainMovementTickHandler}'s
 * departure/arrival transitions) versus what really happened — never adjusted by disruptions
 * themselves, so a hold or extended dwell shows up as growing {@code delaySeconds} rather than
 * quietly resetting the baseline. {@code delaySeconds} is recomputed live every tick (not just at
 * arrival/departure) so a train sitting blocked shows growing delay in real time.
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
        double brakingRateMps2,
        Integer scheduledArrivalSeconds,
        Integer actualArrivalSeconds,
        Integer actualDepartureSeconds,
        int delaySeconds
) {

    /** Used by {@code PassengerBoardingHandler} to record alighting/boarding deltas — every other
     * field is untouched, same convention as {@code TrainMovementTickHandler}'s own with-helpers. */
    public TrainState withPassengerCount(int newPassengerCount) {
        return new TrainState(id, code, lineCode, direction, currentTrackId, previousStationId, nextStationId,
                progress, speedKmph, status, newPassengerCount, capacity, dwellRemainingSeconds, heldSeconds,
                scheduledDepartureSeconds, dwellTimeSeconds, maxSpeedKmph, accelerationMps2, brakingRateMps2,
                scheduledArrivalSeconds, actualArrivalSeconds, actualDepartureSeconds, delaySeconds);
    }

    /** Updates the nominal-vs-actual schedule fields — called at the two real transitions
     * (departure, arrival) in {@code TrainMovementTickHandler}, and by its per-tick live
     * {@code delaySeconds} recompute. Every other field is untouched. */
    public TrainState withScheduleUpdate(long newScheduledDepartureSeconds, Integer newScheduledArrivalSeconds,
                                          Integer newActualArrivalSeconds, Integer newActualDepartureSeconds,
                                          int newDelaySeconds) {
        return new TrainState(id, code, lineCode, direction, currentTrackId, previousStationId, nextStationId,
                progress, speedKmph, status, passengerCount, capacity, dwellRemainingSeconds, heldSeconds,
                newScheduledDepartureSeconds, dwellTimeSeconds, maxSpeedKmph, accelerationMps2, brakingRateMps2,
                newScheduledArrivalSeconds, newActualArrivalSeconds, newActualDepartureSeconds, newDelaySeconds);
    }

    /** Used by {@code TrainMovementTickHandler} to freeze a train a disruption is holding in
     * place (a blocked block, a failed/manually-delayed train) without disturbing its position,
     * status, or dwell/held counters — every other field is untouched. */
    public TrainState withSpeed(double newSpeedKmph) {
        return new TrainState(id, code, lineCode, direction, currentTrackId, previousStationId, nextStationId,
                progress, newSpeedKmph, status, passengerCount, capacity, dwellRemainingSeconds, heldSeconds,
                scheduledDepartureSeconds, dwellTimeSeconds, maxSpeedKmph, accelerationMps2, brakingRateMps2,
                scheduledArrivalSeconds, actualArrivalSeconds, actualDepartureSeconds, delaySeconds);
    }
}
