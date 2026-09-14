package com.nammametro.simulation.domain.model;

/**
 * The persisted train roster entry — identity and static config, not runtime simulation state.
 * {@code lineCode} is the cross-reference key into {@code metro.network.MetroNetwork}'s lines,
 * which is where the discrete-time simulation engine gets real station/track topology from.
 */
public record Train(
        Long id,
        String code,
        Long lineId,
        String lineCode,
        int capacity,
        TrainStatus status,
        Long currentTrackId,
        TrainDirection direction
) {
}
