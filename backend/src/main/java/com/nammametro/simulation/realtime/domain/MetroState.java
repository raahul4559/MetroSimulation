package com.nammametro.simulation.realtime.domain;

import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * The canonical metro state — the one object every frontend system renders from. Built by
 * {@code MetroStateManager}, published on {@code /topic/realtime/state} and served at
 * {@code GET /api/realtime/state}.
 *
 * <p>{@code serverTime} is authoritative: clients correct their own clocks against it rather than
 * trusting the browser's. {@code serviceDay}/{@code dayType} are in Asia/Kolkata. {@code version}
 * increases monotonically within one backend process ({@code instanceId}), so a client can discard
 * out-of-order frames and recognise a backend restart.
 *
 * <p>{@code activeSource} is the source the {@code trains} came from; {@code activeSourceStale} is
 * true when that source's data is past the staleness threshold. {@code simulation} carries the
 * simulation-only extras (signals, passengers, its virtual clock, injected disruptions) and is
 * null whenever {@code activeSource} isn't {@link DataSource#SIMULATION} — no realtime feed reports
 * signal aspects or individual passengers, and none are invented for it.
 */
public record MetroState(
        String instanceId,
        long version,
        Instant serverTime,
        String timezone,
        LocalDate serviceDay,
        String dayType,
        RealtimeMode requestedMode,
        DataSource activeSource,
        boolean activeSourceStale,
        String sourceReason,
        List<ProviderHealth> providers,
        List<LineOperatingStatus> lines,
        List<MetroTrain> trains,
        List<MetroAlert> alerts,
        SimulationState simulation
) {
}
