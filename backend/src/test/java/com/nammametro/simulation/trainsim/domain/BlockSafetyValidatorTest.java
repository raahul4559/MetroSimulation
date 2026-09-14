package com.nammametro.simulation.trainsim.domain;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.tick.ClockAdvanceHandler;
import com.nammametro.simulation.trainsim.application.tick.TrainMovementTickHandler;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Stress-tests the "two trains cannot occupy the same protected section simultaneously" guarantee:
 * many trains contending for the same single-track blocks, run for many ticks, validated after
 * every single one — not just at the end, since a transient mid-tick violation would be just as
 * real a bug as a persistent one.
 */
class BlockSafetyValidatorTest {

    private static final ClockAdvanceHandler CLOCK = new ClockAdvanceHandler();
    private static final TrainMovementTickHandler MOVEMENT = new TrainMovementTickHandler();

    /** A -- B -- C -- D, one line, three single-track blocks, all short enough that trains queue up. */
    private static MetroNetwork fourStationNetwork() {
        Station a = new Station(1, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 20);
        Station b = new Station(2, "B", "Station B", new Coordinates(12.91, 77.51), List.of("L1"), StationType.REGULAR, 20);
        Station c = new Station(3, "C", "Station C", new Coordinates(12.92, 77.52), List.of("L1"), StationType.REGULAR, 20);
        Station d = new Station(4, "D", "Station D", new Coordinates(12.93, 77.53), List.of("L1"), StationType.TERMINAL, 20);

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c, d).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b, c, d)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 60, 6, List.of()));
        network.addTrack(new Track(2, "L1", b.id(), c.id(), 60, 6, List.of()));
        network.addTrack(new Track(3, "L1", c.id(), d.id(), 60, 6, List.of()));
        return network;
    }

    private static TrainState trainAt(long id, String code, long stationId) {
        return new TrainState(id, code, "L1", TrainDirection.OUTBOUND, null, stationId, stationId,
                0, 0, TrainStatus.AT_STATION, 0, 200, 0, 0,
                0, 10, 36.0, 5.0, 5.0);
    }

    @Test
    void manyTrainsQueuingForTheSameBlocksNeverShareOne() {
        MetroNetwork network = fourStationNetwork();
        EngineSettings settings = new EngineSettings(1, 30, 30, 42);
        TickContext ctx = new TickContext(network, settings, new Random(42));

        // Six trains, all starting at A one dwell-cycle apart in the roster — heavy contention for
        // the A->B block, then B->C, then C->D as they funnel through in sequence.
        List<TrainState> trains = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            trains.add(trainAt(i, "T" + i, 1));
        }
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T05:00:00Z"),
                SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 0, 0);
        SimulationState state = new SimulationState(clock, trains, List.of());

        List<String> allIssuesEverSeen = new ArrayList<>();
        int ticksUntilAllComplete = 0;
        for (int i = 0; i < 400; i++) {
            SimulationState afterClock = CLOCK.handle(state, ctx).state();
            state = MOVEMENT.handle(afterClock, ctx).state();

            List<String> issues = BlockSafetyValidator.validate(state);
            allIssuesEverSeen.addAll(issues);

            ticksUntilAllComplete = i + 1;
            if (state.trains().stream().allMatch(t -> t.status() == TrainStatus.COMPLETED)) {
                break;
            }
        }

        assertThat(allIssuesEverSeen).isEmpty();
        assertThat(state.trains()).allMatch(t -> t.status() == TrainStatus.COMPLETED);
        // Sanity: contention actually happened (this wasn't a no-op test) — not all six trains
        // could have crossed all three blocks in the minimum single-train time.
        assertThat(ticksUntilAllComplete).isGreaterThan(60);
    }
}
