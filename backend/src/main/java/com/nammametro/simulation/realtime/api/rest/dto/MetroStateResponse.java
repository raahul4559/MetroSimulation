package com.nammametro.simulation.realtime.api.rest.dto;

import com.nammametro.simulation.realtime.domain.LineOperatingStatus;
import com.nammametro.simulation.realtime.domain.MetroAlert;
import com.nammametro.simulation.realtime.domain.MetroState;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.ProviderHealth;
import com.nammametro.simulation.trainsim.api.rest.dto.DisruptionResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.PassengerMetricsResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.PassengerResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.SignalResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.SimulationClockResponse;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Wire shape of the canonical {@link MetroState} — {@code GET /api/realtime/state} and every frame
 * on {@code /topic/realtime/state}.
 *
 * <p>{@code isLive} is computed here, once, so no client can get the rule wrong: it is true only
 * when the active source is an observed feed ({@code LIVE}/{@code GTFS_REALTIME}) <em>and</em> that
 * feed is fresh. A timetable estimate or a simulation is never live.
 */
public record MetroStateResponse(
        String instanceId,
        long version,
        String serverTime,
        String serverTimeIst,
        long serverEpochMillis,
        String timezone,
        String serviceDay,
        String dayType,
        String requestedMode,
        String activeSource,
        boolean isLive,
        boolean activeSourceStale,
        String sourceReason,
        List<ProviderHealthResponse> providers,
        List<LineStatusResponse> lines,
        List<MetroTrainResponse> trains,
        List<AlertResponse> alerts,
        SimulationExtrasResponse simulation
) {

    public static MetroStateResponse from(MetroState state) {
        return new MetroStateResponse(
                state.instanceId(),
                state.version(),
                state.serverTime().toString(),
                state.serverTime().atZone(MetroTime.ZONE).toOffsetDateTime().toString(),
                state.serverTime().toEpochMilli(),
                state.timezone(),
                state.serviceDay().toString(),
                state.dayType(),
                state.requestedMode().name(),
                state.activeSource().name(),
                state.activeSource().isObserved() && !state.activeSourceStale(),
                state.activeSourceStale(),
                state.sourceReason(),
                state.providers().stream().map(ProviderHealthResponse::from).toList(),
                state.lines().stream().map(LineStatusResponse::from).toList(),
                state.trains().stream().map(MetroTrainResponse::from).toList(),
                state.alerts().stream().map(AlertResponse::from).toList(),
                state.simulation() == null ? null : SimulationExtrasResponse.from(state.simulation()));
    }

    static String iso(Instant instant) {
        return instant == null ? null : instant.toString();
    }

    public record MetroTrainResponse(
            long id,
            String code,
            String lineCode,
            String direction,
            Long currentTrackId,
            long previousStationId,
            long nextStationId,
            double progress,
            Double speedKmph,
            String status,
            Integer passengerCount,
            Integer capacity,
            Integer delaySeconds,
            String nextStationEta,
            Double latitude,
            Double longitude,
            Long scheduledDepartureSeconds,
            Integer dwellTimeSeconds,
            Double maxSpeedKmph,
            Double accelerationMps2,
            Double brakingRateMps2,
            Integer scheduledArrivalSeconds,
            Integer actualArrivalSeconds,
            Integer actualDepartureSeconds,
            String source,
            String vehicleId,
            String tripId,
            String observedAt,
            boolean stale,
            boolean positionEstimated
    ) {

        public static MetroTrainResponse from(MetroTrain t) {
            return new MetroTrainResponse(t.id(), t.code(), t.lineCode(), t.direction().name(), t.currentTrackId(),
                    t.previousStationId(), t.nextStationId(), t.progress(), t.speedKmph(), t.status().name(),
                    t.passengerCount(), t.capacity(), t.delaySeconds(), iso(t.nextStationEta()),
                    t.position() == null ? null : t.position().latitude(),
                    t.position() == null ? null : t.position().longitude(),
                    t.scheduledDepartureSeconds(), t.dwellTimeSeconds(), t.maxSpeedKmph(), t.accelerationMps2(),
                    t.brakingRateMps2(), t.scheduledArrivalSeconds(), t.actualArrivalSeconds(),
                    t.actualDepartureSeconds(), t.source().name(), t.vehicleId(), t.tripId(), iso(t.observedAt()),
                    t.stale(), t.positionEstimated());
        }
    }

    public record ProviderHealthResponse(
            String source,
            String name,
            String status,
            String detail,
            String lastAttemptAt,
            String lastSuccessAt,
            String feedTimestamp,
            String nextAttemptAt,
            int consecutiveFailures,
            int acceptedVehicles,
            int rejectedVehicles,
            Map<String, Integer> rejectionReasons,
            List<String> warnings
    ) {

        public static ProviderHealthResponse from(ProviderHealth h) {
            return new ProviderHealthResponse(h.source().name(), h.name(), h.status().name(), h.detail(),
                    iso(h.lastAttemptAt()), iso(h.lastSuccessAt()), iso(h.feedTimestamp()), iso(h.nextAttemptAt()),
                    h.consecutiveFailures(), h.acceptedVehicles(), h.rejectedVehicles(), h.rejectionReasons(),
                    h.warnings());
        }
    }

    public record LineStatusResponse(
            String lineCode,
            String state,
            String basis,
            String reason,
            String firstDeparture,
            String lastDeparture,
            int trainsReported
    ) {

        public static LineStatusResponse from(LineOperatingStatus s) {
            return new LineStatusResponse(s.lineCode(), s.state().name(), s.basis(), s.reason(), s.firstDeparture(),
                    s.lastDeparture(), s.trainsReported());
        }
    }

    public record AlertResponse(
            String id,
            String source,
            String cause,
            String effect,
            String severity,
            String headerText,
            String descriptionText,
            String activeFrom,
            String activeUntil,
            List<String> lineCodes,
            List<Long> stationIds
    ) {

        public static AlertResponse from(MetroAlert a) {
            return new AlertResponse(a.id(), a.source().name(), a.cause(), a.effect(), a.severity().name(),
                    a.headerText(), a.descriptionText(), iso(a.activeFrom()), iso(a.activeUntil()), a.lineCodes(),
                    a.stationIds());
        }
    }

    /** The simulation-only parts of {@code SimulationStateResponse}; trains are in {@code trains}. */
    public record SimulationExtrasResponse(
            SimulationClockResponse clock,
            List<SignalResponse> signals,
            List<PassengerResponse> passengers,
            PassengerMetricsResponse passengerMetrics,
            List<DisruptionResponse> disruptions
    ) {

        public static SimulationExtrasResponse from(SimulationState state) {
            return new SimulationExtrasResponse(
                    SimulationClockResponse.from(state.clock()),
                    state.signals().stream().map(SignalResponse::from).toList(),
                    state.passengers().stream().map(PassengerResponse::from).toList(),
                    PassengerMetricsResponse.from(state.passengerMetrics()),
                    state.disruptions().stream().map(DisruptionResponse::from).toList());
        }
    }
}
