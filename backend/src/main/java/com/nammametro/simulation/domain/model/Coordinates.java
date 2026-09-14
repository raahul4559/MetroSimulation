package com.nammametro.simulation.domain.model;

/** A geographic point. Latitude/longitude only — schematic (x, y) layout is derived elsewhere. */
public record Coordinates(double latitude, double longitude) {
}
