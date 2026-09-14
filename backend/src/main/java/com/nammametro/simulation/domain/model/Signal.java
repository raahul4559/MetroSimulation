package com.nammametro.simulation.domain.model;

public record Signal(
        Long id,
        Long trackId,
        int positionMetres,
        SignalAspect aspect
) {
}
