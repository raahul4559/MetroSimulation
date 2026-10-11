package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.domain.ServiceState;
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
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T05:59:00")).state()).isEqualTo(ServiceState.NOT_STARTED);
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T09:00:00")).state()).isEqualTo(ServiceState.OPERATING);
        // Last departure 22:00 still completing its run (~3 min end to end in the fixture).
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T22:02:00")).state()).isEqualTo(ServiceState.OPERATING);
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-12T22:30:00")).state()).isEqualTo(ServiceState.ENDED);
    }

    @Test
    void unconfiguredSundayIsUnknownNotBorrowedFromWeekdays() {
        var status = calendar.statusFor("PURPLE", ist("2026-10-18T09:00:00"));
        assertThat(status.state()).isEqualTo(ServiceState.UNKNOWN);
    }

    @Test
    void holidaysUseTheSundayTimetable() {
        var withHoliday = new ServiceCalendar(timetable(Set.of(LocalDate.of(2026, 10, 12))), RealtimeFixtures.network());
        assertThat(withHoliday.dayType(LocalDate.of(2026, 10, 12))).isEqualTo(DayType.SUNDAY);
    }

    @Test
    void noTimetableMeansUnknownEverywhere() {
        var empty = new ServiceCalendar(Timetable.empty(), RealtimeFixtures.network());
        assertThat(empty.statusFor("PURPLE", ist("2026-10-12T09:00:00")).state()).isEqualTo(ServiceState.UNKNOWN);
    }

    @Test
    void notStartedAndEndedPointAtTheRightNextService() {
        // Monday 04:00 IST: today's 06:00.
        var early = calendar.statusFor("PURPLE", ist("2026-10-12T04:00:00"));
        assertThat(early.nextServiceAt()).isEqualTo(ist("2026-10-12T06:00:00"));
        // Monday 23:58 IST: Tuesday 06:00.
        var late = calendar.statusFor("PURPLE", ist("2026-10-12T23:58:00"));
        assertThat(late.state()).isEqualTo(ServiceState.ENDED);
        assertThat(late.nextServiceAt()).isEqualTo(ist("2026-10-13T06:00:00"));
        // Friday night: Saturday borrows weekday hours, so Saturday 06:00 — but Saturday night the
        // Sunday has no hours configured, so the next known service is Monday's.
        assertThat(calendar.statusFor("PURPLE", ist("2026-10-17T23:00:00")).nextServiceAt())
                .isEqualTo(ist("2026-10-19T06:00:00"));
    }

    @Test
    void exceptionsCloseRescheduleOrReassignADay() {
        var withExceptions = new ServiceCalendar(new Timetable("test", LocalTime.of(3, 0), Set.of(),
                timetable(Set.of()).lines(), List.of(
                new Timetable.ScheduleException(LocalDate.of(2026, 10, 13), Set.of("PURPLE"),
                        Timetable.ScheduleException.Kind.CLOSED, null, List.of(), "Maintenance block"),
                new Timetable.ScheduleException(LocalDate.of(2026, 10, 14), Set.of(),
                        Timetable.ScheduleException.Kind.SPECIAL_HOURS, null,
                        List.of(new ServicePeriod(8 * 3600, 25 * 3600, 600)), "Festival hours"))),
                RealtimeFixtures.network());

        var closed = withExceptions.statusFor("PURPLE", ist("2026-10-13T09:00:00"));
        assertThat(closed.state()).isEqualTo(ServiceState.SUSPENDED);
        assertThat(closed.reason()).contains("Maintenance block");
        assertThat(closed.nextServiceAt()).isEqualTo(ist("2026-10-14T08:00:00"));

        // Special hours run past midnight: 00:30 IST on the 15th is still the 14th's service.
        assertThat(withExceptions.statusFor("PURPLE", ist("2026-10-14T07:00:00")).state()).isEqualTo(ServiceState.NOT_STARTED);
        assertThat(withExceptions.statusFor("PURPLE", ist("2026-10-15T00:30:00")).state()).isEqualTo(ServiceState.OPERATING);
        assertThat(withExceptions.scheduleFor("PURPLE", LocalDate.of(2026, 10, 14)).exceptionNotes()).containsExactly("Festival hours");
    }
}
