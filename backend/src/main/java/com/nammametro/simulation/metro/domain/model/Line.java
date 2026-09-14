package com.nammametro.simulation.metro.domain.model;

import java.util.List;

/** {@code orderedStations} is the line's travel-order station sequence, terminus to terminus. */
public record Line(
        long id,
        String code,
        String name,
        String colorHex,
        List<Station> orderedStations
) {
}
