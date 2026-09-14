package com.nammametro.simulation.domain.model;

import java.util.List;

/** {@code orderedStations} is the line's station sequence, e.g. terminus to terminus. */
public record Line(
        Long id,
        String code,
        String name,
        String colourHex,
        LineStatus status,
        List<Station> orderedStations
) {
}
