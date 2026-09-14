package com.nammametro.simulation.domain.model;

/**
 * A line's operator-authored timetable for one direction — first/last departure, headway, and how
 * many trains run it, plus the per-train config (capacity, speed/acceleration/braking, dwell) every
 * train generated from this schedule inherits. Persisted, operator-owned config, same as
 * {@link Train} and {@link SimulationConfig} — see {@code database/README.md}.
 *
 * <p>{@code firstDepartureSeconds}/{@code lastDepartureSeconds} are offsets from
 * {@code simulation_config.start_time}, not wall-clock times — e.g. {@code 0}/{@code 300} means the
 * first train leaves at {@code start_time} and the last 5 simulated minutes later. The DB enforces
 * {@code lastDepartureSeconds == firstDepartureSeconds + headwaySeconds * (trainCount - 1)} so the
 * three numbers can never silently disagree about how many trains there are.
 *
 * <p>A schedule doesn't separately author its trains' starting station — it's always the terminus
 * the line's {@code direction} points away from (mirrors how {@code metro.domain.model.Station}
 * derives its type from line membership rather than an authored flag).
 */
public record LineSchedule(
        Long id,
        Long lineId,
        String lineCode,
        TrainDirection direction,
        int firstDepartureSeconds,
        int lastDepartureSeconds,
        int headwaySeconds,
        int trainCount,
        int dwellTimeSeconds,
        int capacity,
        double maxSpeedKmph,
        double accelerationMps2,
        double brakingRateMps2
) {
}
