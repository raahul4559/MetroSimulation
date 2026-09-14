package com.nammametro.simulation.trainsim.infrastructure;

import com.nammametro.simulation.application.port.out.LineScheduleRepository;
import com.nammametro.simulation.application.port.out.SimulationConfigRepository;
import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.LineSchedule;
import com.nammametro.simulation.domain.model.SimulationConfig;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Plain-Java: no Spring context, fake out-ports — mirrors metro's own network/routing test style. */
class LineScheduleAssemblerTest {

    private static MetroNetwork purpleLineNetwork() {
        Station kengeri = new Station(1, "KENGERI", "Kengeri", new Coordinates(12.90, 77.48), List.of("PURPLE"), StationType.TERMINAL, 60);
        Station majestic = new Station(2, "MAJESTIC", "Majestic", new Coordinates(12.97, 77.57), List.of("PURPLE"), StationType.REGULAR, 30);
        Station whitefield = new Station(3, "WHITEFIELD", "Whitefield", new Coordinates(12.98, 77.74), List.of("PURPLE"), StationType.TERMINAL, 60);

        MetroNetwork network = new MetroNetwork();
        List.of(kengeri, majestic, whitefield).forEach(network::addStation);
        network.addLine(new Line(1, "PURPLE", "Purple Line", "#92278F", List.of(kengeri, majestic, whitefield)));
        return network;
    }

    private static SimulationConfigRepository fixedConfig() {
        SimulationConfig config = new SimulationConfig(1L, "Test", 1000, 1.0, 30, 120, true,
                Instant.parse("2026-01-01T05:00:00Z"), 5, 60, 42L);
        return () -> Optional.of(config);
    }

    private static LineScheduleRepository repositoryOf(LineSchedule... schedules) {
        return () -> List.of(schedules);
    }

    @Test
    void expandsAScheduleIntoSequentiallyCodedTrainsStaggeredByHeadway() {
        LineSchedule schedule = new LineSchedule(10L, 1L, "PURPLE", TrainDirection.OUTBOUND,
                0, 600, 300, 3, 30, 1200, 80.0, 1.0, 1.2);
        LineScheduleAssembler assembler = new LineScheduleAssembler(
                purpleLineNetwork(), repositoryOf(schedule), fixedConfig());

        List<TrainState> trains = assembler.assemble().initialState().trains();

        assertThat(trains).hasSize(3);
        assertThat(trains).extracting(TrainState::code).containsExactly("P01", "P02", "P03");
        assertThat(trains).extracting(TrainState::scheduledDepartureSeconds).containsExactly(0L, 300L, 600L);
        assertThat(trains).allMatch(t -> t.status() == TrainStatus.SCHEDULED);
        assertThat(trains).allMatch(t -> t.previousStationId() == 1); // Kengeri, the OUTBOUND origin
        assertThat(trains).allMatch(t -> t.maxSpeedKmph() == 80.0);
    }

    @Test
    void continuesTheSequenceAcrossBothDirectionsOfTheSameLine() {
        LineSchedule outbound = new LineSchedule(10L, 1L, "PURPLE", TrainDirection.OUTBOUND,
                0, 0, 300, 1, 30, 1200, 80.0, 1.0, 1.2);
        LineSchedule inbound = new LineSchedule(11L, 1L, "PURPLE", TrainDirection.INBOUND,
                0, 0, 300, 1, 30, 1200, 80.0, 1.0, 1.2);
        LineScheduleAssembler assembler = new LineScheduleAssembler(
                purpleLineNetwork(), repositoryOf(outbound, inbound), fixedConfig());

        List<TrainState> trains = assembler.assemble().initialState().trains();

        assertThat(trains).extracting(TrainState::code).containsExactly("P01", "P02");
        TrainState inboundTrain = trains.get(1);
        assertThat(inboundTrain.previousStationId()).isEqualTo(3); // Whitefield, the INBOUND origin
    }

    @Test
    void refusesAScheduleWhoseLastDepartureDisagreesWithHeadwayAndCount() {
        LineSchedule inconsistent = new LineSchedule(10L, 1L, "PURPLE", TrainDirection.OUTBOUND,
                0, 999, 300, 3, 30, 1200, 80.0, 1.0, 1.2); // should be 600, not 999
        LineScheduleAssembler assembler = new LineScheduleAssembler(
                purpleLineNetwork(), repositoryOf(inconsistent), fixedConfig());

        assertThatThrownBy(assembler::assemble)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("inconsistent");
    }
}
