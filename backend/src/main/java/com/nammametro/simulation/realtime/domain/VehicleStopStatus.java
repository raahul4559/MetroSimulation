package com.nammametro.simulation.realtime.domain;

/** GTFS-Realtime's {@code VehicleStopStatus}, relative to {@link VehiclePosition#stopId()}. */
public enum VehicleStopStatus {
    /** About to arrive at the stop. */
    INCOMING_AT,
    /** Standing at the stop. */
    STOPPED_AT,
    /** Departed the previous stop and travelling toward this one. GTFS-Realtime's default. */
    IN_TRANSIT_TO
}
