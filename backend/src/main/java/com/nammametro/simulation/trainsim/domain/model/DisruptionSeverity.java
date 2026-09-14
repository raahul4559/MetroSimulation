package com.nammametro.simulation.trainsim.domain.model;

/**
 * How severe a disruption is. Beyond display, this is the fallback source for
 * {@link Disruption#magnitudeSeconds()} when a caller creates a disruption without specifying one
 * explicitly (see {@code DisruptionController}) — a bigger severity means a bigger default extra
 * dwell/delay for the types that use magnitude ({@code STATION_CONGESTION}, {@code EXTENDED_DWELL},
 * {@code CUSTOM_DELAY}).
 */
public enum DisruptionSeverity {
    MINOR(30),
    MODERATE(90),
    MAJOR(180),
    SEVERE(300);

    private final int defaultMagnitudeSeconds;

    DisruptionSeverity(int defaultMagnitudeSeconds) {
        this.defaultMagnitudeSeconds = defaultMagnitudeSeconds;
    }

    public int defaultMagnitudeSeconds() {
        return defaultMagnitudeSeconds;
    }
}
