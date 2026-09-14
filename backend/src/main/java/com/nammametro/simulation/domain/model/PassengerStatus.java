package com.nammametro.simulation.domain.model;

/** Runtime-only status — passengers are not persisted in this chunk. */
public enum PassengerStatus {
    WAITING,
    BOARDED,
    ALIGHTED
}
