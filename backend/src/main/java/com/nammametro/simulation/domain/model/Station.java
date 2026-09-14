package com.nammametro.simulation.domain.model;

public record Station(
        Long id,
        String code,
        String name,
        Coordinates coordinates,
        boolean interchange,
        int platformCount
) {
}
