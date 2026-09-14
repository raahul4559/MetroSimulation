package com.nammametro.simulation.trainsim.domain.model;

import java.util.Arrays;

/** The fixed set of supported simulation speeds. */
public enum SimulationSpeed {
    HALF(0.5),
    NORMAL(1.0),
    DOUBLE(2.0),
    FIVE_X(5.0),
    TEN_X(10.0),
    FIFTY_X(50.0);

    private final double multiplier;

    SimulationSpeed(double multiplier) {
        this.multiplier = multiplier;
    }

    public double multiplier() {
        return multiplier;
    }

    public static SimulationSpeed fromMultiplier(double multiplier) {
        return Arrays.stream(values())
                .filter(speed -> speed.multiplier == multiplier)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unsupported simulation speed: %sx. Supported: %s".formatted(multiplier, describeAll())));
    }

    public static String describeAll() {
        return Arrays.stream(values()).map(s -> s.multiplier + "x").reduce((a, b) -> a + ", " + b).orElse("");
    }
}
