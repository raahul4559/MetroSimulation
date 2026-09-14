package com.nammametro.simulation.metro.infrastructure.loader.raw;

/** Deserialization target for one entry in {@code data/metro/stations.json}. */
public record RawStation(long id, String code, String name, double latitude, double longitude) {
}
