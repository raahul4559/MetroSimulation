package com.nammametro.simulation.realtime.domain;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Configured operating hours and headways, per line and day type — the only input
 * {@code ServiceCalendar} and {@code ScheduleProvider} have. Deliberately empty by default: real
 * BMRCL hours change (Sunday starts, special-event extensions, new lines), so they must come from a
 * published notice the operator cites in {@code sourceCitation}, never from a hardcoded guess.
 *
 * <p>All times are seconds after midnight IST of the <em>service day</em>, GTFS-style: a train at
 * 00:30 after a late service is {@code 24:30}, i.e. 88200 seconds, of the previous service day.
 * {@code serviceDayRollover} is when one service day ends and the next begins (e.g. 03:00).
 *
 * <p>{@code exceptions} override the regular day-type timetable on specific service days (a
 * closure, special hours for an event, a weekday run on the Sunday timetable). Holidays are the
 * common case of the last and keep their own shorthand.
 */
public record Timetable(
        String sourceCitation,
        LocalTime serviceDayRollover,
        Set<LocalDate> holidays,
        Map<String, LineTimetable> lines,
        List<ScheduleException> exceptions
) {

    public Timetable {
        holidays = holidays == null ? Set.of() : Set.copyOf(holidays);
        lines = lines == null ? Map.of() : Map.copyOf(lines);
        serviceDayRollover = serviceDayRollover == null ? LocalTime.of(3, 0) : serviceDayRollover;
        exceptions = exceptions == null ? List.of() : List.copyOf(exceptions);
    }

    public Timetable(String sourceCitation, LocalTime serviceDayRollover, Set<LocalDate> holidays,
                     Map<String, LineTimetable> lines) {
        this(sourceCitation, serviceDayRollover, holidays, lines, List.of());
    }

    public static Timetable empty() {
        return new Timetable("", LocalTime.of(3, 0), Set.of(), Map.of(), List.of());
    }

    public boolean isConfigured() {
        return lines.values().stream().anyMatch(LineTimetable::hasAnyPeriods)
                || exceptions.stream().anyMatch(e -> e.kind() == ScheduleException.Kind.SPECIAL_HOURS && !e.periods().isEmpty());
    }

    /** The exceptions in force on {@code serviceDay} for {@code lineCode}, in configured order. */
    public List<ScheduleException> exceptionsFor(LocalDate serviceDay, String lineCode) {
        return exceptions.stream().filter(e -> e.date().equals(serviceDay) && e.appliesTo(lineCode)).toList();
    }

    /**
     * A date-specific override. {@code lineCodes} empty means every line.
     *
     * <ul>
     *   <li>{@code CLOSED} — no service at all that day.</li>
     *   <li>{@code SPECIAL_HOURS} — {@code periods} replace the regular timetable that day.</li>
     *   <li>{@code RUN_AS} — the day runs the {@code runAs} day type's timetable (e.g. a festival
     *       weekday on Sunday hours).</li>
     * </ul>
     * {@code note} is shown to the operator (e.g. "Ugadi: services from 07:00").
     */
    public record ScheduleException(
            LocalDate date,
            Set<String> lineCodes,
            Kind kind,
            DayType runAs,
            List<ServicePeriod> periods,
            String note
    ) {

        public ScheduleException {
            lineCodes = lineCodes == null ? Set.of() : Set.copyOf(lineCodes);
            periods = periods == null ? List.of() : List.copyOf(periods);
            if (kind == Kind.RUN_AS && runAs == null) {
                throw new IllegalArgumentException("A RUN_AS exception on " + date + " needs a day type to run as");
            }
            if (kind == Kind.SPECIAL_HOURS && periods.isEmpty()) {
                throw new IllegalArgumentException("A SPECIAL_HOURS exception on " + date + " needs periods");
            }
        }

        public boolean appliesTo(String lineCode) {
            return lineCodes.isEmpty() || lineCodes.contains(lineCode);
        }

        public enum Kind {
            CLOSED,
            SPECIAL_HOURS,
            RUN_AS
        }
    }

    public enum DayType {
        WEEKDAY,
        SATURDAY,
        SUNDAY
    }

    /** {@code periods} per day type. A missing {@code SATURDAY} falls back to {@code WEEKDAY}; a
     * missing {@code SUNDAY} has no fallback — Namma Metro's Sunday hours differ, so an unconfigured
     * Sunday is reported as unknown rather than borrowed from weekdays. */
    public record LineTimetable(Map<DayType, List<ServicePeriod>> periods) {

        public LineTimetable {
            periods = periods == null ? Map.of() : Map.copyOf(periods);
        }

        public List<ServicePeriod> periodsFor(DayType dayType) {
            List<ServicePeriod> direct = periods.get(dayType);
            if (direct != null && !direct.isEmpty()) {
                return direct;
            }
            if (dayType == DayType.SATURDAY) {
                return periods.getOrDefault(DayType.WEEKDAY, List.of());
            }
            return List.of();
        }

        boolean hasAnyPeriods() {
            return periods.values().stream().anyMatch(p -> !p.isEmpty());
        }
    }

    /** Departures from each terminus every {@code headwaySeconds}, from {@code fromSeconds} up to
     * and including {@code toSeconds}. */
    public record ServicePeriod(int fromSeconds, int toSeconds, int headwaySeconds) {

        public ServicePeriod {
            if (headwaySeconds <= 0) {
                throw new IllegalArgumentException("headwaySeconds must be positive, was " + headwaySeconds);
            }
            if (toSeconds < fromSeconds) {
                throw new IllegalArgumentException(
                        "Service period ends (%d) before it starts (%d)".formatted(toSeconds, fromSeconds));
            }
        }
    }
}
