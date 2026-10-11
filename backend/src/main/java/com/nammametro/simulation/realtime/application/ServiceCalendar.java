package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus.OperatingState;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import com.nammametro.simulation.realtime.domain.Timetable.ServicePeriod;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Answers "should this line be running right now?" from the configured {@link Timetable}, in IST.
 * Pure — no Spring, no wall-clock reads; {@code now} is always passed in, so the answer for any
 * instant is reproducible in a test.
 *
 * <p>A line counts as operating from its first departure until its last departure has finished its
 * run (the last train is still in service after it leaves the terminus). With no timetable for the
 * line/day type, the answer is {@link OperatingState#UNKNOWN} — never a guess.
 */
public final class ServiceCalendar {

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

    public DayType dayType(LocalDate serviceDay) {
        if (timetable.holidays().contains(serviceDay) || serviceDay.getDayOfWeek() == DayOfWeek.SUNDAY) {
            return DayType.SUNDAY;
        }
        return serviceDay.getDayOfWeek() == DayOfWeek.SATURDAY ? DayType.SATURDAY : DayType.WEEKDAY;
    }

    /** Every timetabled departure from each terminus on that day type, seconds into the service
     * day, ascending and de-duplicated across period boundaries. */
    public List<Integer> departures(String lineCode, DayType dayType) {
        Timetable.LineTimetable line = timetable.lines().get(lineCode);
        if (line == null) {
            return List.of();
        }
        TreeSet<Integer> departures = new TreeSet<>();
        for (ServicePeriod period : line.periodsFor(dayType)) {
            for (int t = period.fromSeconds(); t <= period.toSeconds(); t += period.headwaySeconds()) {
                departures.add(t);
            }
        }
        return List.copyOf(departures);
    }

    public LineOperatingStatus statusFor(String lineCode, Instant now) {
        LocalDate serviceDay = serviceDay(now);
        DayType dayType = dayType(serviceDay);
        List<Integer> departures = departures(lineCode, dayType);
        if (departures.isEmpty()) {
            String reason = timetable.isConfigured()
                    ? "No timetable configured for %s on a %s".formatted(lineCode, dayType.name().toLowerCase())
                    : "No timetable configured";
            return new LineOperatingStatus(lineCode, OperatingState.UNKNOWN, "TIMETABLE", reason, null, null, 0);
        }

        int first = departures.getFirst();
        int last = departures.getLast();
        int runSeconds = longestRunSecondsByLine.getOrDefault(lineCode, 0);
        long secondsIntoDay = MetroTime.secondsIntoServiceDay(now, serviceDay);
        String firstText = MetroTime.formatServiceTime(first);
        String lastText = MetroTime.formatServiceTime(last);

        if (secondsIntoDay < first) {
            return new LineOperatingStatus(lineCode, OperatingState.NOT_OPERATING, "TIMETABLE",
                    "Before first train (%s IST)".formatted(firstText), firstText, lastText, 0);
        }
        if (secondsIntoDay > last + runSeconds) {
            return new LineOperatingStatus(lineCode, OperatingState.NOT_OPERATING, "TIMETABLE",
                    "After last train (%s IST)".formatted(lastText), firstText, lastText, 0);
        }
        String reason = secondsIntoDay > last
                ? "Last trains completing their runs"
                : "Within timetabled hours";
        return new LineOperatingStatus(lineCode, OperatingState.OPERATING, "TIMETABLE", reason, firstText, lastText, 0);
    }

    public List<LineOperatingStatus> statuses(Instant now) {
        return network.allLines().stream().map(line -> statusFor(line.code(), now)).toList();
    }
}
