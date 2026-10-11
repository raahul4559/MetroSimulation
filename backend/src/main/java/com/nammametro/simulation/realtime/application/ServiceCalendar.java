package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.ServiceState;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import com.nammametro.simulation.realtime.domain.Timetable.ScheduleException;
import com.nammametro.simulation.realtime.domain.Timetable.ServicePeriod;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Answers "should this line be running right now?" from the configured {@link Timetable}, in IST.
 * Pure — no Spring, no wall-clock reads; {@code now} is always passed in, so the answer for any
 * instant is reproducible in a test, and the viewer's (or the server's) own timezone never enters.
 *
 * <p>A line is in service from its first departure until its last departure has finished its run
 * (the last train is still carrying passengers after it leaves the terminus). Date-specific
 * {@link ScheduleException}s are applied before anything else. With no timetable for the line and
 * day, the answer is {@link ServiceState#UNKNOWN} — never a guess.
 */
public final class ServiceCalendar {

    /** How far ahead to look for the next scheduled service (a long closure, an unconfigured day). */
    static final int NEXT_SERVICE_HORIZON_DAYS = 14;

    private final Timetable timetable;
    private final MetroNetwork network;
    private final Map<String, Integer> longestRunSecondsByLine = new HashMap<>();

    public ServiceCalendar(Timetable timetable, MetroNetwork network) {
        this.timetable = timetable;
        this.network = network;
        for (Line line : network.allLines()) {
            int outbound = RouteTimings.of(network, line, TrainDirection.OUTBOUND).totalSeconds();
            int inbound = RouteTimings.of(network, line, TrainDirection.INBOUND).totalSeconds();
            longestRunSecondsByLine.put(line.code(), Math.max(outbound, inbound));
        }
    }

    public Timetable timetable() {
        return timetable;
    }

    public LocalDate serviceDay(Instant now) {
        return MetroTime.serviceDay(now, timetable.serviceDayRollover());
    }

    /** The regular day type for a date: holidays run the Sunday timetable. Exceptions may override
     * it for a particular line — see {@link #scheduleFor}. */
    public DayType dayType(LocalDate serviceDay) {
        if (timetable.holidays().contains(serviceDay) || serviceDay.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return DayType.SUNDAY;
        }
        return switch (serviceDay.getDayOfWeek()) {
            case SATURDAY -> DayType.SATURDAY;
            case MONDAY -> DayType.MONDAY;
            default -> DayType.WEEKDAY;
        };
    }

    /**
     * One line's resolved timetable for one service day, exceptions applied.
     * {@code departuresByDirection} are each terminus's timetabled departures, seconds into the
     * service day, ascending; {@code departures} is both directions merged. Empty when the line is
     * closed that day or nothing is configured.
     */
    public record DaySchedule(LocalDate serviceDay, DayType dayType,
                              Map<TrainDirection, List<Integer>> departuresByDirection, boolean closed,
                              List<String> exceptionNotes) {

        public DaySchedule {
            departuresByDirection = Map.copyOf(departuresByDirection);
            exceptionNotes = List.copyOf(exceptionNotes);
        }

        public List<Integer> departures() {
            TreeSet<Integer> all = new TreeSet<>();
            departuresByDirection.values().forEach(all::addAll);
            return List.copyOf(all);
        }

        public List<Integer> departures(TrainDirection direction) {
            return departuresByDirection.getOrDefault(direction, List.of());
        }

        public boolean hasService() {
            return !closed && departuresByDirection.values().stream().anyMatch(d -> !d.isEmpty());
        }
    }

    public DaySchedule scheduleFor(String lineCode, LocalDate serviceDay) {
        DayType dayType = dayType(serviceDay);
        Timetable.LineTimetable lineTimetable = timetable.lines().get(lineCode);
        List<ServicePeriod> specialHours = null;
        boolean closed = false;
        List<String> notes = new ArrayList<>();
        for (ScheduleException exception : timetable.exceptionsFor(serviceDay, lineCode)) {
            switch (exception.kind()) {
                case CLOSED -> closed = true;
                case SPECIAL_HOURS -> specialHours = exception.periods();
                case RUN_AS -> dayType = exception.runAs();
            }
            notes.add(describe(exception));
        }

        Map<TrainDirection, List<Integer>> byDirection = new java.util.EnumMap<>(TrainDirection.class);
        for (TrainDirection direction : TrainDirection.values()) {
            List<ServicePeriod> periods = closed ? List.of()
                    : specialHours != null ? specialHours
                    : lineTimetable == null ? List.of()
                    : lineTimetable.periodsFor(dayType, direction);
            byDirection.put(direction, expand(periods));
        }
        return new DaySchedule(serviceDay, dayType, byDirection, closed, notes);
    }

    /** Every departure in {@code periods}: each row's start, every headway after it, and its end. */
    static List<Integer> expand(List<ServicePeriod> periods) {
        TreeSet<Integer> departures = new TreeSet<>();
        for (ServicePeriod period : periods) {
            for (int t = period.fromSeconds(); t <= period.toSeconds(); t += period.headwaySeconds()) {
                departures.add(t);
            }
            departures.add(period.toSeconds());
        }
        return List.copyOf(departures);
    }

    public LineOperatingStatus statusFor(String lineCode, Instant now) {
        LocalDate serviceDay = serviceDay(now);
        DaySchedule schedule = scheduleFor(lineCode, serviceDay);
        String notes = schedule.exceptionNotes().isEmpty() ? "" : " (" + String.join("; ", schedule.exceptionNotes()) + ")";

        if (schedule.closed()) {
            return status(lineCode, ServiceState.SUSPENDED, "EXCEPTION", "No service today" + notes, null, null,
                    nextServiceAt(lineCode, serviceDay.plusDays(1)), serviceDay);
        }
        if (schedule.departures().isEmpty()) {
            String reason = timetable.isConfigured()
                    ? "No timetable configured for %s on a %s".formatted(lineCode, schedule.dayType().name().toLowerCase())
                    : "No timetable configured — operating hours unknown";
            return status(lineCode, ServiceState.UNKNOWN, "NONE", reason + notes, null, null, null, serviceDay);
        }

        int first = schedule.departures().getFirst();
        int last = schedule.departures().getLast();
        int runSeconds = longestRunSecondsByLine.getOrDefault(lineCode, 0);
        long secondsIntoDay = MetroTime.secondsIntoServiceDay(now, serviceDay);
        String firstText = MetroTime.formatServiceTime(first);
        String lastText = MetroTime.formatServiceTime(last);

        if (secondsIntoDay < first) {
            return status(lineCode, ServiceState.NOT_STARTED, "TIMETABLE",
                    "First train at %s IST".formatted(firstText) + notes, first, last,
                    MetroTime.atServiceDaySeconds(serviceDay, first), serviceDay);
        }
        if (secondsIntoDay > last + runSeconds) {
            return status(lineCode, ServiceState.ENDED, "TIMETABLE",
                    "Last train left at %s IST".formatted(lastText) + notes, first, last,
                    nextServiceAt(lineCode, serviceDay.plusDays(1)), serviceDay);
        }
        String reason = secondsIntoDay > last ? "Last trains completing their runs" : "Within timetabled hours";
        return status(lineCode, ServiceState.OPERATING, "TIMETABLE", reason + notes, first, last, null, serviceDay);
    }

    public List<LineOperatingStatus> statuses(Instant now) {
        return network.allLines().stream().map(line -> statusFor(line.code(), now)).toList();
    }

    /** The first timetabled departure on or after {@code fromServiceDay}, within the horizon. */
    public Instant nextServiceAt(String lineCode, LocalDate fromServiceDay) {
        for (int i = 0; i < NEXT_SERVICE_HORIZON_DAYS; i++) {
            DaySchedule schedule = scheduleFor(lineCode, fromServiceDay.plusDays(i));
            if (schedule.hasService()) {
                return MetroTime.atServiceDaySeconds(schedule.serviceDay(), schedule.departures().getFirst());
            }
        }
        return null;
    }

    /** Every exception in force on {@code serviceDay}, for any line, described for display. */
    public List<String> exceptionNotes(LocalDate serviceDay) {
        return timetable.exceptions().stream().filter(e -> e.date().equals(serviceDay)).map(ServiceCalendar::describe).toList();
    }

    private LineOperatingStatus status(String lineCode, ServiceState state, String basis, String reason, Integer first,
                                       Integer last, Instant nextServiceAt, LocalDate serviceDay) {
        return new LineOperatingStatus(lineCode, state, basis, reason,
                first == null ? null : MetroTime.formatServiceTime(first),
                last == null ? null : MetroTime.formatServiceTime(last),
                first == null ? null : MetroTime.atServiceDaySeconds(serviceDay, first),
                last == null ? null : MetroTime.atServiceDaySeconds(serviceDay, last),
                nextServiceAt, 0, List.of());
    }

    private static String describe(ScheduleException exception) {
        if (exception.note() != null && !exception.note().isBlank()) {
            return exception.note();
        }
        return switch (exception.kind()) {
            case CLOSED -> "closed";
            case SPECIAL_HOURS -> "special hours";
            case RUN_AS -> "running the " + exception.runAs().name().toLowerCase() + " timetable";
        };
    }
}
