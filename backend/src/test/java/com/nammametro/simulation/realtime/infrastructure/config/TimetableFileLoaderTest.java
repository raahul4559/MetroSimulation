package com.nammametro.simulation.realtime.infrastructure.config;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.application.ServiceCalendar;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Loads the real {@code data/metro/timetable.json} and pins BMRCL's published first and last trains. */
class TimetableFileLoaderTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 12);
    private static final LocalDate TUESDAY = LocalDate.of(2026, 10, 13);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 10, 17);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 10, 18);

    private static MetroNetwork network() {
        MetroNetwork network = new MetroNetwork();
        network.addLine(new Line(1, "PURPLE", "Purple Line", "#800080", List.of()));
        network.addLine(new Line(2, "GREEN", "Green Line", "#008000", List.of()));
        network.addLine(new Line(3, "YELLOW", "Yellow Line", "#FFD700", List.of()));
        return network;
    }

    private final MetroNetwork network = network();
    private final Timetable timetable = TimetableFileLoader.load(
            new ClassPathResource("metro-data/timetable.json"), new ObjectMapper(), network);
    private final ServiceCalendar calendar = new ServiceCalendar(timetable, network);

    private static String hhmm(int seconds) {
        return String.format("%02d:%02d", seconds / 3600, seconds / 60 % 60);
    }

    private String first(String line, LocalDate day, TrainDirection direction) {
        return hhmm(calendar.scheduleFor(line, day).departures(direction).getFirst());
    }

    private String last(String line, LocalDate day, TrainDirection direction) {
        return hhmm(calendar.scheduleFor(line, day).departures(direction).getLast());
    }

    @Test
    void citesTheOfficialSource() {
        assertThat(timetable.sourceCitation()).contains("bmrc.co.in");
    }

    @Test
    void mondayHasItsOwnEarlierTimetable() {
        assertThat(calendar.dayType(MONDAY)).isEqualTo(DayType.MONDAY);
        assertThat(calendar.dayType(TUESDAY)).isEqualTo(DayType.WEEKDAY);
        for (String line : List.of("PURPLE", "GREEN")) {
            assertThat(first(line, MONDAY, TrainDirection.OUTBOUND)).isEqualTo("04:15");
            assertThat(first(line, TUESDAY, TrainDirection.OUTBOUND)).isEqualTo("05:00");
        }
        assertThat(first("YELLOW", MONDAY, TrainDirection.OUTBOUND)).isEqualTo("05:05");
        assertThat(first("YELLOW", TUESDAY, TrainDirection.OUTBOUND)).isEqualTo("06:00");
    }

    @Test
    void sundayStartsAtSeven() {
        for (String line : List.of("PURPLE", "GREEN", "YELLOW")) {
            for (TrainDirection direction : TrainDirection.values()) {
                assertThat(first(line, SUNDAY, direction)).as(line + " " + direction).isEqualTo("07:00");
            }
        }
    }

    @Test
    void eachTerminusHasItsOwnLastTrain() {
        assertThat(last("PURPLE", TUESDAY, TrainDirection.OUTBOUND)).isEqualTo("23:05");
        assertThat(last("PURPLE", TUESDAY, TrainDirection.INBOUND)).isEqualTo("22:45");
        assertThat(last("GREEN", TUESDAY, TrainDirection.OUTBOUND)).isEqualTo("22:57");
        assertThat(last("GREEN", SATURDAY, TrainDirection.OUTBOUND)).isEqualTo("23:00");
        assertThat(last("GREEN", TUESDAY, TrainDirection.INBOUND)).isEqualTo("23:05");
        assertThat(last("YELLOW", TUESDAY, TrainDirection.OUTBOUND)).isEqualTo("23:55");
        assertThat(last("YELLOW", TUESDAY, TrainDirection.INBOUND)).isEqualTo("22:42");
    }
}
