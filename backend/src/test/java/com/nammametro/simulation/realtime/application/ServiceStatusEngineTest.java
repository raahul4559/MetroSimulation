package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroAlert;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.NetworkServiceStatus;
import com.nammametro.simulation.realtime.domain.ServiceAlert;
import com.nammametro.simulation.realtime.domain.ServiceState;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import com.nammametro.simulation.realtime.domain.Timetable.ServicePeriod;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ServiceStatusEngineTest {

    /** Two lines; test hours only (not BMRCL's): PURPLE 05:00–23:00, GREEN 06:00–22:00, weekdays. */
    private static MetroNetwork twoLines() {
        MetroNetwork network = RealtimeFixtures.network();
        Station d = new Station(4, "D", "Delta", new Coordinates(12.99, 77.50), List.of("GREEN"), StationType.TERMINAL, 30);
        Station e = new Station(5, "E", "Echo", new Coordinates(12.99, 77.51), List.of("GREEN"), StationType.TERMINAL, 30);
        network.addStation(d);
        network.addStation(e);
        network.addLine(new Line(2, "GREEN", "Green Line", "#00FF00", List.of(d, e)));
        network.addTrack(new Track(21, "GREEN", d.id(), e.id(), 1000, 60, List.of()));
        return network;
    }

    private static Timetable.LineTimetable weekdays(int fromHour, int toHour) {
        return new Timetable.LineTimetable(Map.of(DayType.WEEKDAY,
                List.of(new ServicePeriod(fromHour * 3600, toHour * 3600, 600))));
    }

    private final MetroNetwork network = twoLines();
    private final ServiceStatusEngine engine = new ServiceStatusEngine(new ServiceCalendar(
            new Timetable("Test notice", LocalTime.of(3, 0), Set.of(),
                    Map.of("PURPLE", weekdays(5, 23), "GREEN", weekdays(6, 22))), network), network);

    private static Instant ist(String localDateTime) {
        return LocalDateTime.parse(localDateTime).atZone(MetroTime.ZONE).toInstant();
    }

    private NetworkServiceStatus at(String ist, List<MetroAlert> alerts, List<MetroTrain> trains) {
        return engine.evaluate(ist(ist), alerts, trains);
    }

    private static MetroAlert alert(String effect, ServiceAlert.AlertSeverity severity, List<String> lines, List<Long> stations) {
        return new MetroAlert("a1", DataSource.GTFS_REALTIME, null, effect, severity, "Signal failure", null, null, null,
                lines, stations);
    }

    private static MetroTrain observedOn(String line, DataSource source, boolean stale) {
        return new MetroTrain(1, "T", line, TrainDirection.OUTBOUND, null, 1, 1, 0, null, TrainStatus.DWELLING, null,
                null, null, null, null, null, null, null, null, null, null, null, null, source, "v", null,
                Instant.EPOCH, stale, false);
    }

    @Test
    void midEveningEveryLineIsOperating() {
        NetworkServiceStatus status = at("2026-10-12T20:35:00", List.of(), List.of());
        assertThat(status.state()).isEqualTo(ServiceState.OPERATING);
        assertThat(status.started()).isTrue();
        assertThat(status.operating()).isTrue();
        assertThat(status.ended()).isFalse();
        assertThat(status.nextServiceAt()).isNull();
        assertThat(status.lastDepartureAt()).isEqualTo(ist("2026-10-12T23:00:00"));
        assertThat(status.timetableSource()).isEqualTo("Test notice");
    }

    @Test
    void beforeTheFirstTrainItHasNotStartedAndNamesTheEarliestLine() {
        NetworkServiceStatus status = at("2026-10-12T04:30:00", List.of(), List.of());
        assertThat(status.state()).isEqualTo(ServiceState.NOT_STARTED);
        assertThat(status.started()).isFalse();
        assertThat(status.nextServiceAt()).isEqualTo(ist("2026-10-12T05:00:00"));
        assertThat(status.nextServiceLineCode()).isEqualTo("PURPLE");
    }

    @Test
    void lateAtNightItHasEndedAndPointsAtTomorrow() {
        // 23:58 Monday: GREEN ended at 22:00 + run; PURPLE's last train left 23:00, run is ~3 min.
        NetworkServiceStatus status = at("2026-10-12T23:58:00", List.of(), List.of());
        assertThat(status.state()).isEqualTo(ServiceState.ENDED);
        assertThat(status.ended()).isTrue();
        assertThat(status.nextServiceAt()).isEqualTo(ist("2026-10-13T05:00:00"));
        assertThat(status.reason()).contains("next scheduled service 05:00 IST");
    }

    @Test
    void oneLineEndedWhileAnotherRunsIsStillOperating() {
        NetworkServiceStatus status = at("2026-10-12T22:30:00", List.of(), List.of());
        assertThat(status.state()).isEqualTo(ServiceState.OPERATING);
        assertThat(status.lines()).extracting(l -> l.lineCode() + ":" + l.state())
                .containsExactlyInAnyOrder("PURPLE:OPERATING", "GREEN:ENDED");
    }

    @Test
    void alertsSuspendOrDisruptTheLinesTheyName() {
        NetworkServiceStatus suspended = at("2026-10-12T12:00:00",
                List.of(alert("NO_SERVICE", ServiceAlert.AlertSeverity.SEVERE, List.of("GREEN"), List.of())), List.of());
        assertThat(suspended.state()).isEqualTo(ServiceState.DISRUPTED);
        assertThat(suspended.lines()).filteredOn(l -> l.lineCode().equals("GREEN")).singleElement()
                .satisfies(l -> {
                    assertThat(l.state()).isEqualTo(ServiceState.SUSPENDED);
                    assertThat(l.basis()).isEqualTo("ALERT");
                    assertThat(l.reason()).isEqualTo("Signal failure");
                });
        assertThat(suspended.disruptionAlertIds()).containsExactly("a1");

        // A station-level alert disrupts the line(s) serving that station.
        NetworkServiceStatus delayed = at("2026-10-12T12:00:00",
                List.of(alert("SIGNIFICANT_DELAYS", ServiceAlert.AlertSeverity.WARNING, List.of(), List.of(2L))), List.of());
        assertThat(delayed.lines()).filteredOn(l -> l.lineCode().equals("PURPLE")).singleElement()
                .extracting(l -> l.state()).isEqualTo(ServiceState.DISRUPTED);
        assertThat(delayed.lines()).filteredOn(l -> l.lineCode().equals("GREEN")).singleElement()
                .extracting(l -> l.state()).isEqualTo(ServiceState.OPERATING);

        // Informational alerts don't disrupt anything.
        assertThat(at("2026-10-12T12:00:00", List.of(alert("OTHER_EFFECT", ServiceAlert.AlertSeverity.INFO,
                List.of("PURPLE"), List.of())), List.of()).state()).isEqualTo(ServiceState.OPERATING);
    }

    @Test
    void observedTrainsProveServiceButEstimatesAndSimulationsDoNot() {
        var unknownHours = new ServiceStatusEngine(new ServiceCalendar(Timetable.empty(), network), network);
        Instant noon = ist("2026-10-12T12:00:00");

        assertThat(unknownHours.evaluate(noon, List.of(), List.of()).state()).isEqualTo(ServiceState.UNKNOWN);
        assertThat(unknownHours.evaluate(noon, List.of(), List.of(observedOn("PURPLE", DataSource.SIMULATION, false),
                observedOn("PURPLE", DataSource.SCHEDULE, false), observedOn("PURPLE", DataSource.GTFS_REALTIME, true)))
                .state()).isEqualTo(ServiceState.UNKNOWN);

        NetworkServiceStatus observed = unknownHours.evaluate(noon, List.of(),
                List.of(observedOn("PURPLE", DataSource.LIVE, false)));
        assertThat(observed.state()).isEqualTo(ServiceState.OPERATING);
        assertThat(observed.lines()).filteredOn(l -> l.lineCode().equals("PURPLE")).singleElement()
                .satisfies(l -> assertThat(l.basis()).isEqualTo("REALTIME"));
        // Without a timetable there is never a next-service time to show.
        assertThat(observed.nextServiceAt()).isNull();
    }

    @Test
    void noTimetableIsUnknownWithNoInventedTimes() {
        var unknownHours = new ServiceStatusEngine(new ServiceCalendar(Timetable.empty(), network), network);
        NetworkServiceStatus status = unknownHours.evaluate(ist("2026-10-12T23:58:00"), List.of(), List.of());
        assertThat(status.state()).isEqualTo(ServiceState.UNKNOWN);
        assertThat(status.timetableConfigured()).isFalse();
        assertThat(status.nextServiceAt()).isNull();
        assertThat(status.lastDepartureAt()).isNull();
        assertThat(status.reason()).contains("unknown");
    }
}
