package com.nammametro.simulation.metro.infrastructure.loader.raw;

import java.util.List;

/** Deserialization target for one entry in {@code data/metro/lines.json}. */
public record RawLine(long id, String code, String name, String color, List<String> stationCodes) {
}
