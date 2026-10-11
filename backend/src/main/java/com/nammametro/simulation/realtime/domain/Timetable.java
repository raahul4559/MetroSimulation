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
 */
public record Timetable(
        String sourceCitation,
        LocalTime serviceDayRollover,
        Set<LocalDate> holidays,
        Map<String, LineTimetable> lines
) {

    public Timetable {
        holidays = holidays == null ? Set.of() : Set.copyOf(holidays);
        lines = lines == null ? Map.of() : Map.copyOf(lines);
        serviceDayRollover = serviceDayRollover == null ? LocalTime.of(3, 0) : serviceDayRollover;
    }

    public static Timetable empty() {
        return new Timetable("", LocalTime.of(3, 0), Set.of(), Map.of());
    }

    public boolean isConfigured() {
        return lines.values().stream().anyMatch(LineTimetable::hasAnyPeriods);
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
