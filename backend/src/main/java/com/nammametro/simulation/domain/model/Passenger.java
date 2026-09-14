package com.nammametro.simulation.domain.model;

/** Runtime-only — generated and consumed in-memory by the simulation engine, never persisted. */
public record Passenger(
        Long id,
        Long originStationId,
        Long destinationStationId,
        long spawnedAtTick,
        PassengerStatus status
) {
}
