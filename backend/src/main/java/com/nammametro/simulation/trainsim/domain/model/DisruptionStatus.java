package com.nammametro.simulation.trainsim.domain.model;

/**
 * A disruption's lifecycle. {@code SCHEDULED}/{@code ACTIVE}/{@code RESOLVED} are driven purely by
 * simulated time (see {@code DisruptionEffectsHandler}) — {@code CANCELLED} is the one
 * user-triggered terminal state (early cancellation via {@code DisruptionController}), and once set
 * it is never overwritten by the time-driven transitions.
 */
public enum DisruptionStatus {
    SCHEDULED,
    ACTIVE,
    RESOLVED,
    CANCELLED
}
