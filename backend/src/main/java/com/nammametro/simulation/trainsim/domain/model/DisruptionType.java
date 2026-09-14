package com.nammametro.simulation.trainsim.domain.model;

/**
 * The kind of operational disruption in effect. Each type has a fixed {@link AffectedResourceType}
 * (see {@link Disruption#resourceTypeFor}) — a train breaking down always targets a train, a
 * blocked track always targets a track, and so on — so callers never need to pair a type with an
 * arbitrary resource kind.
 */
public enum DisruptionType {
    TRAIN_FAILURE,
    SIGNAL_FAILURE,
    STATION_CONGESTION,
    TRACK_BLOCKAGE,
    EXTENDED_DWELL,
    CUSTOM_DELAY
}
