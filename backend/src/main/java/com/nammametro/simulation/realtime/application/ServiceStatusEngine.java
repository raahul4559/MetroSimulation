package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus;
import com.nammametro.simulation.realtime.domain.MetroAlert;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.NetworkServiceStatus;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.ServiceState;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * The operating-status engine: is Namma Metro running right now, line by line and as a whole?
 * Pure — {@code now} (server time, authoritative) is passed in and every date/time is IST, so the
 * answer never depends on any computer's timezone.
 *
 * <p>Evidence, strongest first:
 * <ol>
 *   <li><b>Realtime alerts</b> from the active observed feed: a {@code NO_SERVICE} alert on a whole
 *       line suspends it; any other alert that affects running (reduced service, significant
 *       delays, detours, a station closed, or anything {@code SEVERE}) makes an operating line
 *       {@code DISRUPTED}.</li>
 *   <li><b>Trains observed running</b> (fresh positions from a {@code LIVE}/{@code GTFS_REALTIME}
 *       feed): a line with observed trains is operating, even outside timetabled hours or with no
 *       timetable at all. Timetable estimates and simulated trains are not evidence — the first is
 *       the timetable itself, the second is invented.</li>
 *   <li><b>The timetable</b> ({@link ServiceCalendar}): not started / operating / ended, with date
 *       exceptions applied.</li>
 * </ol>
 * Nothing known leaves a line {@code UNKNOWN}.
 *
 * <p>Network-wide: running if any line runs ({@code DISRUPTED} if any line is disrupted or
 * suspended meanwhile); {@code SUSPENDED} if every line with a known status is; otherwise
 * {@code NOT_STARTED} if any line is still to start today, else {@code ENDED}; {@code UNKNOWN}
 * when no line's status is known.
 */
public final class ServiceStatusEngine {

    private static final Set<String> DISRUPTING_EFFECTS = Set.of(
            "NO_SERVICE", "REDUCED_SERVICE", "SIGNIFICANT_DELAYS", "DETOUR", "MODIFIED_SERVICE", "STOP_MOVED");

    private final ServiceCalendar calendar;
    private final MetroNetwork network;

    public ServiceStatusEngine(ServiceCalendar calendar, MetroNetwork network) {
        this.calendar = calendar;
        this.network = network;
    }

    public NetworkServiceStatus evaluate(Instant now, List<MetroAlert> alerts, List<MetroTrain> trains) {
        LocalDate serviceDay = calendar.serviceDay(now);

        Map<String, Integer> observedRunning = new HashMap<>();
        for (MetroTrain train : trains) {
            if (train.source().isObserved() && !train.stale()) {
                observedRunning.merge(train.lineCode(), 1, Integer::sum);
            }
        }

        List<LineOperatingStatus> lines = new ArrayList<>();
        Set<String> disruptionIds = new LinkedHashSet<>();
        for (LineOperatingStatus timetabled : calendar.statuses(now)) {
            List<MetroAlert> lineAlerts = alerts.stream().filter(a -> affects(a, timetabled.lineCode())).toList();
            LineOperatingStatus status = applyEvidence(timetabled, lineAlerts,
                    observedRunning.getOrDefault(timetabled.lineCode(), 0));
            lines.add(status);
            if (status.state() == ServiceState.SUSPENDED || status.state() == ServiceState.DISRUPTED) {
                disruptionIds.addAll(status.alertIds());
            }
        }

        ServiceState state = aggregate(lines);
        List<LineOperatingStatus> known = lines.stream().filter(l -> l.state() != ServiceState.UNKNOWN).toList();
        boolean operating = state == ServiceState.OPERATING || state == ServiceState.DISRUPTED;
        boolean started = known.stream().anyMatch(l -> l.state() != ServiceState.NOT_STARTED
                && l.firstDepartureAt() != null && !now.isBefore(l.firstDepartureAt())) || operating;
        boolean ended = !known.isEmpty() && known.stream().allMatch(l -> l.state() == ServiceState.ENDED);

        LineOperatingStatus next = lines.stream()
                .filter(l -> l.nextServiceAt() != null && l.nextServiceAt().isAfter(now))
                .min(Comparator.comparing(LineOperatingStatus::nextServiceAt))
                .orElse(null);
        Instant firstDeparture = lines.stream().map(LineOperatingStatus::firstDepartureAt).filter(Objects::nonNull)
                .min(Comparator.naturalOrder()).orElse(null);
        Instant lastDeparture = lines.stream().map(LineOperatingStatus::lastDepartureAt).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null);

        return new NetworkServiceStatus(now, serviceDay, calendar.dayType(serviceDay).name(), state,
                reason(state, lines, next, now), started, operating, ended, firstDeparture, lastDeparture,
                next == null ? null : next.nextServiceAt(), next == null ? null : next.lineCode(),
                calendar.exceptionNotes(serviceDay), calendar.timetable().isConfigured(),
                calendar.timetable().sourceCitation(), lines, List.copyOf(disruptionIds));
    }

    private LineOperatingStatus applyEvidence(LineOperatingStatus timetabled, List<MetroAlert> alerts, int observed) {
        List<String> alertIds = alerts.stream().map(MetroAlert::id).toList();

        MetroAlert suspension = alerts.stream().filter(this::suspendsWholeLine).findFirst().orElse(null);
        if (suspension != null && timetabled.state() != ServiceState.ENDED) {
            return timetabled.with(ServiceState.SUSPENDED, "ALERT", headline(suspension, "Service suspended"), observed,
                    alertIds);
        }

        ServiceState state = timetabled.state();
        String basis = timetabled.basis();
        String reason = timetabled.reason();
        if (observed > 0 && state != ServiceState.OPERATING) {
            reason = switch (state) {
                case NOT_STARTED -> "Trains reported running before the first timetabled departure";
                case ENDED -> "Trains reported running after the last timetabled departure";
                default -> "Trains reported running";
            };
            state = ServiceState.OPERATING;
            basis = "REALTIME";
        }

        MetroAlert disruption = alerts.stream().filter(this::disrupts).findFirst().orElse(null);
        if (disruption != null && state == ServiceState.OPERATING) {
            return timetabled.with(ServiceState.DISRUPTED, "ALERT", headline(disruption, "Service disrupted"), observed,
                    alertIds);
        }
        return timetabled.with(state, basis, reason, observed, alertIds);
    }

    private static ServiceState aggregate(List<LineOperatingStatus> lines) {
        List<ServiceState> known = lines.stream().map(LineOperatingStatus::state).filter(s -> s != ServiceState.UNKNOWN).toList();
        if (known.isEmpty()) {
            return ServiceState.UNKNOWN;
        }
        boolean anyRunning = known.contains(ServiceState.OPERATING) || known.contains(ServiceState.DISRUPTED);
        if (anyRunning) {
            return known.contains(ServiceState.DISRUPTED) || known.contains(ServiceState.SUSPENDED)
                    ? ServiceState.DISRUPTED : ServiceState.OPERATING;
        }
        if (known.stream().allMatch(s -> s == ServiceState.SUSPENDED)) {
            return ServiceState.SUSPENDED;
        }
        return known.contains(ServiceState.NOT_STARTED) ? ServiceState.NOT_STARTED : ServiceState.ENDED;
    }

    private static String reason(ServiceState state, List<LineOperatingStatus> lines, LineOperatingStatus next,
                                 Instant now) {
        String nextText = next == null ? ""
                : "; next scheduled service %s IST".formatted(formatIst(next.nextServiceAt(), now));
        return switch (state) {
            case OPERATING -> "Service operating";
            case DISRUPTED -> "Service disrupted on " + String.join(", ", lines.stream()
                    .filter(l -> l.state() == ServiceState.DISRUPTED || l.state() == ServiceState.SUSPENDED)
                    .map(LineOperatingStatus::lineCode).toList());
            case SUSPENDED -> "Service suspended" + nextText;
            case NOT_STARTED -> "Service has not started yet" + nextText;
            case ENDED -> "Service has ended for the day" + nextText;
            case UNKNOWN -> lines.isEmpty() ? "No lines" : lines.getFirst().reason();
        };
    }

    /** {@code HH:mm} IST — prefixed with the date when it is later than tomorrow (IST calendar). */
    private static String formatIst(Instant instant, Instant now) {
        var ist = instant.atZone(MetroTime.ZONE);
        String time = "%02d:%02d".formatted(ist.getHour(), ist.getMinute());
        LocalDate today = now.atZone(MetroTime.ZONE).toLocalDate();
        return ist.toLocalDate().isAfter(today.plusDays(1)) ? ist.toLocalDate() + " " + time : time;
    }

    private boolean affects(MetroAlert alert, String lineCode) {
        if (alert.lineCodes().isEmpty() && alert.stationIds().isEmpty()) {
            return true; // network-wide
        }
        if (alert.lineCodes().contains(lineCode)) {
            return true;
        }
        return alert.stationIds().stream()
                .map(network::findStation)
                .flatMap(java.util.Optional::stream)
                .map(Station::lineCodes)
                .anyMatch(codes -> codes.contains(lineCode));
    }

    private boolean suspendsWholeLine(MetroAlert alert) {
        return alert.suspendsService() && alert.stationIds().isEmpty();
    }

    private boolean disrupts(MetroAlert alert) {
        return (alert.effect() != null && DISRUPTING_EFFECTS.contains(alert.effect().toUpperCase()))
                || alert.severity() == ServiceAlert.AlertSeverity.SEVERE;
    }

    private static String headline(MetroAlert alert, String fallback) {
        return alert.headerText() != null && !alert.headerText().isBlank() ? alert.headerText() : fallback;
    }
}
