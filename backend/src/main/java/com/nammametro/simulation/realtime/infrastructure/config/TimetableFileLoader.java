package com.nammametro.simulation.realtime.infrastructure.config;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import com.nammametro.simulation.realtime.domain.Timetable.ScheduleException;
import com.nammametro.simulation.realtime.domain.Timetable.ServicePeriod;
import org.springframework.core.io.Resource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Reads the operator timetable file ({@code data/metro/timetable.json}, on the classpath as
 * {@code metro-data/timetable.json}) — BMRCL's published hours, transcribed row for row, with the
 * source cited in the file. Shape, per line:
 *
 * <pre>
 * "PURPLE": {
 *   "outbound": { "terminus": "…", "monday": [rows], "weekday": [rows], "saturday": [rows], "sunday": [rows] },
 *   "inbound":  { … }
 * }
 * row = { "from": "HH:mm", "to": "HH:mm", "headwayMinutes": 12.5 }
 * </pre>
 * A line may instead give the day keys directly (shared by both directions). Validated like the
 * network dataset: an unknown line, a malformed time or a non-positive headway fails startup with
 * the offending entry named, rather than silently mis-reporting whether the metro is running.
 */
final class TimetableFileLoader {

    private static final Map<String, DayType> DAY_KEYS = Map.of(
            "weekday", DayType.WEEKDAY, "monday", DayType.MONDAY, "saturday", DayType.SATURDAY,
            "sunday", DayType.SUNDAY);

    private TimetableFileLoader() {
    }

    static Timetable load(Resource resource, ObjectMapper json, MetroNetwork network) {
        String where = resource.getDescription();
        JsonNode root;
        try (InputStream in = resource.getInputStream()) {
            root = json.readTree(in);
        } catch (IOException | RuntimeException e) {
            throw new IllegalStateException("Could not read timetable " + where + ": " + e.getMessage(), e);
        }

        String rolloverText = text(root, "serviceDayRollover");
        LocalTime rollover = rolloverText == null ? LocalTime.of(3, 0)
                : LocalTime.ofSecondOfDay(time(rolloverText, where + " serviceDayRollover") % 86_400);

        Set<LocalDate> holidays = new HashSet<>();
        for (JsonNode holiday : root.path("holidays")) {
            holidays.add(LocalDate.parse(holiday.asString()));
        }

        Map<String, Timetable.LineTimetable> lines = new HashMap<>();
        for (Map.Entry<String, JsonNode> entry : root.path("lines").properties()) {
            String lineCode = entry.getKey().toUpperCase(Locale.ROOT);
            String lineWhere = where + " lines." + entry.getKey();
            if (network.findLineByCode(lineCode).isEmpty()) {
                throw new IllegalStateException(lineWhere + " is not a line in this network");
            }
            JsonNode line = entry.getValue();
            Map<TrainDirection, Map<DayType, List<ServicePeriod>>> byDirection = new EnumMap<>(TrainDirection.class);
            for (TrainDirection direction : TrainDirection.values()) {
                JsonNode node = line.get(direction.name().toLowerCase(Locale.ROOT));
                if (node != null) {
                    byDirection.put(direction, days(node, lineWhere + "." + direction.name().toLowerCase(Locale.ROOT)));
                }
            }
            lines.put(lineCode, new Timetable.LineTimetable(days(line, lineWhere), byDirection));
        }

        List<ScheduleException> exceptions = new ArrayList<>();
        int i = 0;
        for (JsonNode e : root.path("exceptions")) {
            String exceptionWhere = where + " exceptions[" + i++ + "]";
            try {
                Set<String> lineCodes = new HashSet<>();
                for (JsonNode code : e.path("lines")) {
                    lineCodes.add(code.asString().toUpperCase(Locale.ROOT));
                }
                String runAs = text(e, "runAs");
                exceptions.add(new ScheduleException(LocalDate.parse(e.path("date").asString()), lineCodes,
                        ScheduleException.Kind.valueOf(e.path("type").asString().toUpperCase(Locale.ROOT)),
                        runAs == null ? null : DayType.valueOf(runAs.toUpperCase(Locale.ROOT)),
                        periods(e.path("periods"), exceptionWhere + ".periods"), text(e, "note")));
            } catch (RuntimeException ex) {
                throw new IllegalStateException(exceptionWhere + ": " + ex.getMessage(), ex);
            }
        }

        String source = text(root, "source");
        return new Timetable(source == null ? "" : source, rollover, holidays, lines, exceptions);
    }

    private static Map<DayType, List<ServicePeriod>> days(JsonNode node, String where) {
        Map<DayType, List<ServicePeriod>> days = new EnumMap<>(DayType.class);
        for (Map.Entry<String, DayType> key : DAY_KEYS.entrySet()) {
            JsonNode rows = node.get(key.getKey());
            if (rows != null) {
                days.put(key.getValue(), periods(rows, where + "." + key.getKey()));
            }
        }
        return days;
    }

    private static List<ServicePeriod> periods(JsonNode rows, String where) {
        List<ServicePeriod> periods = new ArrayList<>();
        int i = 0;
        for (JsonNode row : rows) {
            String rowWhere = where + "[" + i++ + "]";
            double headwayMinutes = row.path("headwayMinutes").asDouble(Double.NaN);
            if (!(headwayMinutes > 0)) {
                throw new IllegalStateException(rowWhere + ": headwayMinutes must be a positive number");
            }
            try {
                periods.add(new ServicePeriod(time(text(row, "from"), rowWhere + ".from"),
                        time(text(row, "to"), rowWhere + ".to"), (int) Math.round(headwayMinutes * 60)));
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException(rowWhere + ": " + e.getMessage(), e);
            }
        }
        return periods;
    }

    private static int time(String value, String where) {
        if (value == null) {
            throw new IllegalStateException(where + " is missing");
        }
        try {
            return MetroTime.parseServiceTime(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(where + ": " + e.getMessage(), e);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.asString().isBlank() ? null : value.asString();
    }
}
