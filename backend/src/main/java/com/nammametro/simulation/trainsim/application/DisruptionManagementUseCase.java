package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.DisruptionSeverity;
import com.nammametro.simulation.trainsim.domain.model.DisruptionType;

import java.util.List;

/**
 * Create/list/cancel operations on {@link Disruption}s — the in-port {@code DisruptionController}
 * drives. {@code resourceId} must already be resolved to the concrete network entity the
 * {@code type} targets (a track id for {@code TRACK_BLOCKAGE}/{@code SIGNAL_FAILURE}, a station id
 * for {@code STATION_CONGESTION}, a train id otherwise) — see {@code Disruption#resourceTypeFor}.
 * A created disruption always starts at the current simulated time (no "schedule for later" via
 * this API, though the underlying model supports it).
 */
public interface DisruptionManagementUseCase {

    List<Disruption> listDisruptions();

    Disruption createDisruption(DisruptionType type, long resourceId, int durationSeconds,
                                 DisruptionSeverity severity, int magnitudeSeconds, String description);

    void cancelDisruption(long id);
}
