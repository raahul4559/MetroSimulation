package com.nammametro.simulation.metro.domain.model;

import java.util.List;

/** A station shared by more than one line — computed by {@code MetroNetwork}, never stored directly. */
public record Interchange(Station station, List<Line> connectedLines) {
}
