package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Namma Metro's operating status as a whole, at {@code evaluatedAt} (server time — authoritative).
 *
 * <p>{@code serviceDay}/{@code dayType} are in Asia/Kolkata; the service day rolls over at the
 * timetable's configured hour, so 00:30 IST still belongs to the previous day's service.
 * {@code started}/{@code operating}/{@code ended} are the network-wide answers to "has service
 * started / is it running / has it ended" for that service day.
 *
 * <p>{@code nextServiceAt} (with the line it is on) and {@code lastDepartureAt} come only from the
 * timetable; they are null whenever it has no hours to give. {@code scheduleExceptions} describes
 * any date-specific exception in effect today. {@code timetableSource} is the citation the operator
 * gave for the hours; empty means none were configured.
 */
public record NetworkServiceStatus(
        Instant evaluatedAt,
        LocalDate serviceDay,
        String dayType,
        ServiceState state,
        String reason,
        boolean started,
        boolean operating,
        boolean ended,
        Instant firstDepartureAt,
        Instant lastDepartureAt,
        Instant nextServiceAt,
        String nextServiceLineCode,
        List<String> scheduleExceptions,
        boolean timetableConfigured,
        String timetableSource,
        List<LineOperatingStatus> lines,
        List<String> disruptionAlertIds
) {

    public NetworkServiceStatus {
        scheduleExceptions = scheduleExceptions == null ? List.of() : List.copyOf(scheduleExceptions);
        lines = lines == null ? List.of() : List.copyOf(lines);
        disruptionAlertIds = disruptionAlertIds == null ? List.of() : List.copyOf(disruptionAlertIds);
    }
}
