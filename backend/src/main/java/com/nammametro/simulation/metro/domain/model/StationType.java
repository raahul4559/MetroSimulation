package com.nammametro.simulation.metro.domain.model;

/**
 * Derived at load time from line membership — never authored directly in the dataset, so it can't
 * drift out of sync with it. {@code defaultDwellTimeSeconds} is a placeholder default; per-station
 * dwell tuning is a future feature.
 */
public enum StationType {
    REGULAR(30),
    TERMINAL(60),
    INTERCHANGE(45);

    private final int defaultDwellTimeSeconds;

    StationType(int defaultDwellTimeSeconds) {
        this.defaultDwellTimeSeconds = defaultDwellTimeSeconds;
    }

    public int defaultDwellTimeSeconds() {
        return defaultDwellTimeSeconds;
    }
}
