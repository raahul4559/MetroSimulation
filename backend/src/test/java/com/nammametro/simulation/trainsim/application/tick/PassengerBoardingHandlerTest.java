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
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
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

class PassengerBoardingHandlerTest {

    private static final PassengerBoardingHandler HANDLER = new PassengerBoardingHandler();

    private static final long A = 1;
    private static final long B = 2;
    private static final long C = 3;

    /** A -- B -- C, one line, two blocks. */
    private static MetroNetwork threeStationNetwork() {
        Station a = new Station(A, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 30);
        Station b = new Station(B, "B", "Station B", new Coordinates(12.91, 77.51), List.of("L1"), StationType.REGULAR, 30);
        Station c = new Station(C, "C", "Station C", new Coordinates(12.92, 77.52), List.of("L1"), StationType.TERMINAL, 30);

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b, c)));
        network.addTrack(new Track(1, "L1", A, B, 1000, 60, List.of()));
        network.addTrack(new Track(2, "L1", B, C, 1000, 60, List.of()));
        return network;
    }

    private static TrainState atStation(long id, long stationId, int passengerCount, int capacity) {
        return new TrainState(id, "T" + id, "L1", TrainDirection.OUTBOUND, null, stationId, stationId,
                0, 0, TrainStatus.AT_STATION, passengerCount, capacity, 0, 0, 0, 30, 36.0, 1.0, 1.2);
    }

    private static Passenger waiting(long id, long stationId, long destinationStationId, List<Long> route, int routeIndex) {
        return new Passenger(id, route.getFirst(), destinationStationId, route, routeIndex, stationId, null,
                PassengerStatus.WAITING, 0, null, null);
    }

    private static SimulationState stateWith(List<TrainState> trains, List<Passenger> passengers) {
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T05:00:00Z"),
                SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 5, 500);
        return new SimulationState(clock, trains, List.of(), passengers, PassengerMetrics.empty(), List.of());
    }

    private static TickContext contextFor(MetroNetwork network) {
        return new TickContext(network, new EngineSettings(5, 120, 60, 42), new Random(42));
    }

    @Test
    void alightingFreesCapacityForANewBoarderInTheSameArrivalEvent() {
        MetroNetwork network = threeStationNetwork();
        TrainState train = atStation(100, B, 1, 1); // full: 1/1

        // P1 rode A->B and is at their final destination; P2 waits at B wanting to continue to C.
        Passenger destB = new Passenger(1, A, B, List.of(A, B), 1, null, 100L, PassengerStatus.ON_TRAIN, 0, 0L, null);
        Passenger p2 = waiting(2, B, C, List.of(B, C), 0);

        SimulationState state = stateWith(List.of(train), List.of(destB, p2));
        SimulationState result = HANDLER.handle(state, contextFor(network)).state();

        TrainState updatedTrain = result.trains().get(0);
        assertThat(updatedTrain.passengerCount()).isEqualTo(1); // -1 alighted, +1 boarded

        Passenger p1After = byId(result, 1);
        assertThat(p1After.status()).isEqualTo(PassengerStatus.ALIGHTING);
        assertThat(p1After.currentStationId()).isEqualTo(B);
        assertThat(p1After.currentTrainId()).isNull();

        Passenger p2After = byId(result, 2);
        assertThat(p2After.status()).isEqualTo(PassengerStatus.BOARDING);
        assertThat(p2After.currentTrainId()).isEqualTo(100L);
        assertThat(p2After.routeIndex()).isEqualTo(1); // alights at C, the end of this A-B-C-spanning single-line leg
    }

    @Test
    void aFullTrainLeavesWaitingPassengersBehindAndCountsThemAsUnableToBoard() {
        MetroNetwork network = threeStationNetwork();
        TrainState train = atStation(100, A, 1, 1); // already full, nobody to alight at the origin terminus
        Passenger waitingAtA = waiting(2, A, C, List.of(A, B, C), 0);

        SimulationState state = stateWith(List.of(train), List.of(waitingAtA));
        SimulationState result = HANDLER.handle(state, contextFor(network)).state();

        assertThat(result.trains().get(0).passengerCount()).isEqualTo(1);
        assertThat(byId(result, 2).status()).isEqualTo(PassengerStatus.WAITING);
        assertThat(result.passengerMetrics().totalUnableToBoard()).isEqualTo(1);
    }

    @Test
    void transitionalStatusesResolveOnTheNextHandlerCall() {
        MetroNetwork network = threeStationNetwork();
        TrainState train = atStation(100, A, 0, 10);
        Passenger waitingAtA = waiting(2, A, C, List.of(A, B, C), 0);

        SimulationState afterFirstTick = HANDLER.handle(stateWith(List.of(train), List.of(waitingAtA)), contextFor(network)).state();
        assertThat(byId(afterFirstTick, 2).status()).isEqualTo(PassengerStatus.BOARDING);

        // Second call (simulating the next tick): the train is no longer AT_STATION (it's since departed),
        // but the leftover BOARDING passenger still resolves to ON_TRAIN.
        TrainState departed = new TrainState(100, "T100", "L1", TrainDirection.OUTBOUND, 1L, A, B,
                0.1, 10, TrainStatus.RUNNING, 1, 10, 0, 0, 0, 30, 36.0, 1.0, 1.2);
        SimulationState secondTickInput = new SimulationState(afterFirstTick.clock(), List.of(departed), List.of(),
                afterFirstTick.passengers(), afterFirstTick.passengerMetrics(), List.of());
        SimulationState afterSecondTick = HANDLER.handle(secondTickInput, contextFor(network)).state();

        assertThat(byId(afterSecondTick, 2).status()).isEqualTo(PassengerStatus.ON_TRAIN);
    }

    @Test
    void aPassengerReachingFinalDestinationCompletesAndIsRemovedFromTheActiveRosterOnResolve() {
        MetroNetwork network = threeStationNetwork();
        TrainState train = atStation(100, B, 1, 5);
        Passenger destB = new Passenger(9, A, B, List.of(A, B), 1, null, 100L, PassengerStatus.ON_TRAIN, 100, 100L, null);

        SimulationState afterFirstTick = HANDLER.handle(stateWith(List.of(train), List.of(destB)), contextFor(network)).state();
        assertThat(byId(afterFirstTick, 9).status()).isEqualTo(PassengerStatus.ALIGHTING);

        TrainState stillAtB = atStation(100, B, 0, 5);
        SimulationState secondTickInput = new SimulationState(afterFirstTick.clock(), List.of(stillAtB), List.of(),
                afterFirstTick.passengers(), afterFirstTick.passengerMetrics(), List.of());
        SimulationState afterSecondTick = HANDLER.handle(secondTickInput, contextFor(network)).state();

        assertThat(afterSecondTick.passengers()).noneMatch(p -> p.id() == 9);
        assertThat(afterSecondTick.passengerMetrics().totalServed()).isEqualTo(1);
        assertThat(afterSecondTick.passengerMetrics().totalJourneySeconds()).isEqualTo(400); // 500 - 100
    }

    private static Passenger byId(SimulationState state, long id) {
        return state.passengers().stream().filter(p -> p.id() == id).findFirst().orElseThrow();
    }
}
