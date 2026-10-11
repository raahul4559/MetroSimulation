package com.nammametro.simulation.realtime.application;

import java.time.Duration;

/**
 * Freshness and placement thresholds shared by normalization and the state manager.
 *
 * @param staleAfter            a train (or provider) whose newest observation is older than this
 *                              is marked stale — still shown, flagged, never extrapolated further
 * @param expireAfter           older than this, a train is dropped entirely rather than left
 *                              frozen on the map
 * @param maxClockSkew          provider timestamps up to this far in the future are clamped to
 *                              now; further than that, the observation is treated as now and
 *                              counted as a clock-skew warning
 * @param maxSnapDistanceMetres a reported coordinate further than this from its line's track is
 *                              rejected as off-network rather than snapped
 */
public record RealtimeSettings(
        Duration staleAfter,
        Duration expireAfter,
        Duration maxClockSkew,
        double maxSnapDistanceMetres
) {

    public RealtimeSettings {
        if (staleAfter.isNegative() || staleAfter.isZero()) {
            throw new IllegalArgumentException("staleAfter must be positive");
        }
        if (expireAfter.compareTo(staleAfter) <= 0) {
            throw new IllegalArgumentException("expireAfter must be longer than staleAfter");
        }
    }

    public static RealtimeSettings defaults() {
        return new RealtimeSettings(Duration.ofSeconds(90), Duration.ofMinutes(5), Duration.ofSeconds(30), 1500);
    }
}
