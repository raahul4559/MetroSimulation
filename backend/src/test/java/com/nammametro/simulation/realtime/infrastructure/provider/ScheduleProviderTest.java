package com.nammametro.simulation.realtime.infrastructure.provider;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.RealtimeFixtures;
import com.nammametro.simulation.realtime.application.FeedNormalizer;
import com.nammametro.simulation.realtime.application.RealtimeSettings;
import com.nammametro.simulation.realtime.application.ServiceCalendar;
import com.nammametro.simulation.realtime.domain.DataSource;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.MetroTrain;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.domain.Timetable.DayType;
import com.nammametro.simulation.realtime.domain.Timetable.ServicePeriod;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ScheduleProviderTest {

    private final MetroNetwork network = RealtimeFixtures.network();
    /** Test hours only: one departure from each end at 06:00 IST on weekdays. */
    private final ServiceCalendar calendar = new ServiceCalendar(new Timetable("test", LocalTime.of(3, 0), Set.of(),
            Map.of("PURPLE", new Timetable.LineTimetable(Map.of(DayType.WEEKDAY,
                    List.of(new ServicePeriod(6 * 3600, 6 * 3600, 600)))))), network);
    private final ScheduleProvider provider = new ScheduleProvider(network, calendar);

    private static Instant ist(String localDateTime) {
        return LocalDateTime.parse(localDateTime).atZone(MetroTime.ZONE).toInstant();
    }

    private List<MetroTrain> trainsAt(Instant now) {
        var result = new FeedNormalizer(network, RealtimeSettings.defaults())
                .normalize(DataSource.SCHEDULE, provider.mapping(), provider.fetchSnapshot(now), now);
        assertThat(result.rejections()).isEmpty();
        return result.trains().stream().sorted(Comparator.comparing(MetroTrain::direction)).toList();
    }

    @Test
    void timetabledTrainsAreWhereTheTimetableSaysAndLabelledSchedule() {
        // 06:00:30 IST: both runs are half way along their first 60 s leg.
        List<MetroTrain> trains = trainsAt(ist("2026-10-12T06:00:30"));

        assertThat(trains).hasSize(2);
        MetroTrain outbound = trains.getFirst();
        assertThat(outbound.direction()).isEqualTo(TrainDirection.OUTBOUND);
        assertThat(outbound.source()).isEqualTo(DataSource.SCHEDULE);
        assertThat(outbound.previousStationId()).isEqualTo(1);
        assertThat(outbound.nextStationId()).isEqualTo(2);
        assertThat(outbound.progress()).isCloseTo(0.5, within(0.02));
        // A timetable knows no delays.
        assertThat(outbound.delaySeconds()).isNull();

        MetroTrain inbound = trains.getLast();
        assertThat(inbound.previousStationId()).isEqualTo(3);
        assertThat(inbound.nextStationId()).isEqualTo(2);
    }

    @Test
    void trainsDwellAtIntermediateStations() {
        // Arrive B at +60 s, dwell 30 s.
        List<MetroTrain> trains = trainsAt(ist("2026-10-12T06:01:10"));
        assertThat(trains).allSatisfy(t -> {
            assertThat(t.status()).isEqualTo(TrainStatus.DWELLING);
            assertThat(t.previousStationId()).isEqualTo(2);
        });
    }

    @Test
    void nothingRunsOutsideTheTimetable() {
        assertThat(provider.fetchSnapshot(ist("2026-10-12T05:00:00")).vehiclePositions()).isEmpty();
        assertThat(provider.fetchSnapshot(ist("2026-10-12T07:00:00")).vehiclePositions()).isEmpty();
    }
}
