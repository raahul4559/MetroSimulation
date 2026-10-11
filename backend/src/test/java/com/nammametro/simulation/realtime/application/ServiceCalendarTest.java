package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.domain.LineOperatingStatus.OperatingState;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import com.nammametro.simulation.realtime.domain.Timetable.ServicePeriod;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ServiceCalendarTest {

    /** Test hours only — not BMRCL's. Weekdays 06:00–22:00 every 10 min; no Sunday entry. */
    private static Timetable timetable(Set<LocalDate> holidays) {
        return new Timetable("test", LocalTime.of(3, 0), holidays, Map.of("PURPLE", new Timetable.LineTimetable(
                Map.of(DayType.WEEKDAY, List.of(new ServicePeriod(6 * 3600, 22 * 3600, 600))))));
    }

    private static java.time.Instant ist(String localDateTime) {
        return ZonedDateTime.of(java.time.LocalDateTime.parse(localDateTime), MetroTime.ZONE).toInstant();
    }

    private final ServiceCalendar calendar = new ServiceCalendar(timetable(Set.of()), RealtimeFixtures.network());

    @Test
    void serviceDayRollsOverAtTheConfiguredHourInIst() {
        // 01:30 IST on Tuesday is still Monday's service day; 2026-10-12 is a Monday.
        assertThat(calendar.serviceDay(ist("2026-10-13T01:30:00"))).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(calendar.serviceDay(ist("2026-10-13T03:00:00"))).isEqualTo(LocalDate.of(2026, 10, 13));
        // 20:00 UTC Monday is 01:30 IST Tuesday — the zone, not the JVM default, decides.
        assertThat(calendar.serviceDay(java.time.Instant.parse("2026-10-12T20:00:00Z"))).isEqualTo(LocalDate.of(2026, 10, 12));
    }

    @Test
    void operatingWindowFollowsTheTimetable() {
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T05:59:00")).state()).isEqualTo(OperatingState.NOT_OPERATING);
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T09:00:00")).state()).isEqualTo(OperatingState.OPERATING);
        // Last departure 22:00 still completing its run (~3 min end to end in the fixture).
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T22:02:00")).state()).isEqualTo(OperatingState.OPERATING);
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T22:30:00")).state()).isEqualTo(OperatingState.NOT_OPERATING);
    }

    @Test
    void unconfiguredSundayIsUnknownNotBorrowedFromWeekdays() {
        var status = calendar.statusFor("PURPLE", ist("2026-10-18T09:00:00"));
        assertThat(status.state()).isEqualTo(OperatingState.UNKNOWN);
    }

    @Test
    void holidaysUseTheSundayTimetable() {
        var withHoliday = new ServiceCalendar(timetable(Set.of(LocalDate.of(2026, 10, 12))), RealtimeFixtures.network());
        assertThat(withHoliday.dayType(LocalDate.of(2026, 10, 12))).isEqualTo(DayType.SUNDAY);
    }

    @Test
    void noTimetableMeansUnknownEverywhere() {
        var empty = new ServiceCalendar(Timetable.empty(), RealtimeFixtures.network());
        assertThat(empty.statusFor("PURPLE", ist("2026-10-12T09:00:00")).state()).isEqualTo(OperatingState.UNKNOWN);
    }
}
