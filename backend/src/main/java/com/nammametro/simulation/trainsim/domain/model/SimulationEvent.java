package com.nammametro.simulation.trainsim.domain.model;

import java.time.Instant;

/** A discrete, named occurrence within a tick — broadcast separately from the continuous state stream. */
public record SimulationEvent(
        long tick,
        Instant simulationTime,
        EventType type,
        long trainId,
        String trainCode,
        Long stationId,
        String message
) {
}
