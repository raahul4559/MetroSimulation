package com.nammametro.simulation.trainsim.api.rest.dto;

import com.nammametro.simulation.trainsim.domain.model.DisruptionSeverity;
import com.nammametro.simulation.trainsim.domain.model.DisruptionType;

/**
 * Body for {@code POST /api/simulation/disruptions}. For {@code TRACK_BLOCKAGE}/
 * {@code SIGNAL_FAILURE}, supply {@code fromStationId}/{@code toStationId} (resolved server-side
 * to the connecting track via {@code MetroNetwork#getSingleTrackBetween}); for every other type,
 * supply {@code resourceId} directly (a train id, or a station id for {@code STATION_CONGESTION}).
 * {@code magnitudeSeconds} defaults to {@code severity}'s own default when omitted; {@code description}
 * defaults to an auto-generated one when blank.
 */
public record CreateDisruptionRequest(
        DisruptionType type,
        Long resourceId,
        Long fromStationId,
        Long toStationId,
        int durationSeconds,
        DisruptionSeverity severity,
        Integer magnitudeSeconds,
        String description
) {
}
