package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.EventType;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class TrainDispatcherTest {

    private static final ClockAdvanceHandler CLOCK = new ClockAdvanceHandler();
    private static final TrainDispatcher DISPATCHER = new TrainDispatcher();

    private static MetroNetwork oneStationNetwork() {
        Station a = new Station(1, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 30);
        Station b = new Station(2, "B", "Station B", new Coordinates(12.91, 77.51), List.of("L1"), StationType.TERMINAL, 30);
        MetroNetwork network = new MetroNetwork();
        List.of(a, b).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 100, 10, List.of()));
        return network;
    }

    private static TrainState scheduledTrainAt(long id, String code, long stationId, long scheduledDepartureSeconds) {
        return new TrainState(id, code, "L1", TrainDirection.OUTBOUND, null, stationId, stationId,
                0, 0, TrainStatus.SCHEDULED, 0, 200, 0, 0,
                scheduledDepartureSeconds, 30, 36.0, 10.0, 10.0);
    }

    private static TickContext contextFor(MetroNetwork network) {
        return new TickContext(network, new EngineSettings(5, 120, 60, 42), new Random(42));
    }

    @Test
    void trainStaysScheduledUntilItsDepartureTimeThenDispatches() {
        MetroNetwork network = oneStationNetwork();
        TickContext ctx = contextFor(network);
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T05:00:00Z"),
                SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 0, 0);
        SimulationState state = new SimulationState(clock, List.of(scheduledTrainAt(1, "T1", 1, 12)));

        // Ticks 1 and 2 (elapsed 5s, 10s): still before the scheduled 12s departure.
        for (int i = 0; i < 2; i++) {
            SimulationState afterClock = CLOCK.handle(state, ctx).state();
            TickResult result = DISPATCHER.handle(afterClock, ctx);
            state = result.state();
            assertThat(result.events()).isEmpty();
            assertThat(state.trains().get(0).status()).isEqualTo(TrainStatus.SCHEDULED);
        }

        // Tick 3 (elapsed 15s >= 12s scheduled departure): dispatched into AT_STATION.
        SimulationState afterClock = CLOCK.handle(state, ctx).state();
        TickResult result = DISPATCHER.handle(afterClock, ctx);
        state = result.state();

        TrainState dispatched = state.trains().get(0);
        assertThat(dispatched.status()).isEqualTo(TrainStatus.AT_STATION);
        assertThat(dispatched.previousStationId()).isEqualTo(1);
        assertThat(result.events()).hasSize(1);
        assertThat(result.events().get(0).type()).isEqualTo(EventType.DISPATCHED);
        assertThat(result.events().get(0).trainCode()).isEqualTo("T1");
    }
}
