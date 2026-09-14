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
import com.nammametro.simulation.trainsim.domain.model.BlockState;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.EventType;
import com.nammametro.simulation.trainsim.domain.model.Signal;
import com.nammametro.simulation.trainsim.domain.model.SignalAspect;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
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

class TrainMovementTickHandlerTest {

    private static final ClockAdvanceHandler CLOCK = new ClockAdvanceHandler();
    private static final TrainMovementTickHandler MOVEMENT = new TrainMovementTickHandler();

    /** Reaches maxSpeed (10m/s) after 2s over 10m, cruises 80m, brakes symmetrically — chosen so a
     * 100m track resolves in a clean, hand-verifiable 12 one-second ticks, with at least one tick
     * of partial (neither zero nor max) speed observable on both the accel and brake ramps. */
    private static final double MAX_SPEED_KMPH = 36.0;
    private static final double ACCEL_MPS2 = 5.0;
    private static final double BRAKE_MPS2 = 5.0;
    private static final int DWELL_SECONDS = 30;

    /** A(1) -- 100m --> B(2) -- 100m --> C(3), one line, three stations. */
    private static MetroNetwork threeStationNetwork() {
        Station a = new Station(1, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 30);
        Station b = new Station(2, "B", "Station B", new Coordinates(12.91, 77.51), List.of("L1"), StationType.REGULAR, 30);
        Station c = new Station(3, "C", "Station C", new Coordinates(12.92, 77.52), List.of("L1"), StationType.TERMINAL, 30);

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b, c)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 100, 10, List.of()));
        network.addTrack(new Track(2, "L1", b.id(), c.id(), 100, 10, List.of()));
        return network;
    }

    private static TrainState trainAt(long id, String code, long stationId) {
        return new TrainState(id, code, "L1", TrainDirection.OUTBOUND, null, stationId, stationId,
                0, 0, TrainStatus.AT_STATION, 0, 200, 0, 0,
                0, DWELL_SECONDS, MAX_SPEED_KMPH, ACCEL_MPS2, BRAKE_MPS2, null, null, null, 0);
    }

    private static SimulationState initialState(TrainState... trains) {
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T05:00:00Z"),
                SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 0, 0);
        return new SimulationState(clock, List.of(trains), List.of(), List.of(), PassengerMetrics.empty(), List.of());
    }

    private static TickContext contextFor(MetroNetwork network) {
        // baseSimSecondsPerTick=1 gives fine-grained, easy-to-verify accel/cruise/brake integration.
        EngineSettings settings = new EngineSettings(1, 120, 60, 42);
        return new TickContext(network, settings, new Random(42));
    }

    private static SimulationState tick(SimulationState state, TickContext ctx, List<SimulationEvent> collectedEvents) {
        SimulationState afterClock = CLOCK.handle(state, ctx).state();
        TickResult result = MOVEMENT.handle(afterClock, ctx);
        collectedEvents.addAll(result.events());
        return result.state();
    }

    @Test
    void trainNeverTeleportsProgressIncreasesContinuouslyZeroToOne() {
        MetroNetwork network = threeStationNetwork();
        TickContext ctx = contextFor(network);
        SimulationState state = initialState(trainAt(1, "T1", 1));
        List<SimulationEvent> events = new ArrayList<>();

        List<TrainState> observed = new ArrayList<>();
        // AT_STATION -> DWELLING (30 one-second ticks) -> DEPARTING -> RUNNING (12 ticks) -> ARRIVING
        for (int i = 0; i < 45; i++) {
            state = tick(state, ctx, events);
            observed.add(state.trains().get(0));
        }

        // Progress is always in [0,1], and only ever resets to 0 at a genuine leg boundary (status
        // freshly RUNNING/DEPARTING after not being on this track the tick before) — never mid-leg.
        double previousProgress = 0;
        TrainStatus previousStatus = TrainStatus.AT_STATION;
        for (TrainState t : observed) {
            assertThat(t.progress()).isBetween(0.0, 1.0);
            boolean sameLegContinuing = t.status() == TrainStatus.RUNNING && previousStatus == TrainStatus.RUNNING;
            if (sameLegContinuing) {
                assertThat(t.progress()).isGreaterThanOrEqualTo(previousProgress);
            }
            previousProgress = t.progress();
            previousStatus = t.status();
        }
        // Proof it doesn't teleport: real interior progress values are observed mid-leg, not just
        // the 0 (departed) and 1 (arrived) endpoints.
        assertThat(observed).anyMatch(t -> t.progress() > 0.0 && t.progress() < 1.0);
        // And speed actually ramps up and back down rather than snapping to a flat average.
        assertThat(observed).anyMatch(t -> t.speedKmph() > 0 && t.speedKmph() < MAX_SPEED_KMPH);
        assertThat(observed).anyMatch(t -> t.speedKmph() == MAX_SPEED_KMPH);
    }

    @Test
    void fullTripReachesCompletedAtFinalStationAndEmitsExpectedEvents() {
        MetroNetwork network = threeStationNetwork();
        TickContext ctx = contextFor(network);
        SimulationState state = initialState(trainAt(1, "T1", 1));
        List<SimulationEvent> events = new ArrayList<>();

        TrainStatus finalStatus = null;
        for (int i = 0; i < 200 && finalStatus != TrainStatus.COMPLETED; i++) {
            state = tick(state, ctx, events);
            finalStatus = state.trains().get(0).status();
        }

        assertThat(finalStatus).isEqualTo(TrainStatus.COMPLETED);
        List<EventType> eventTypes = events.stream().map(SimulationEvent::type).toList();
        assertThat(eventTypes).contains(
                EventType.DWELL_STARTED, EventType.DEPARTED, EventType.ARRIVED, EventType.ROUTE_COMPLETED);
        // Two legs (A->B, B->C): departed and arrived should each fire twice.
        assertThat(eventTypes.stream().filter(t -> t == EventType.DEPARTED).count()).isEqualTo(2);
        assertThat(eventTypes.stream().filter(t -> t == EventType.ARRIVED).count()).isEqualTo(2);
    }

    @Test
    void secondTrainIsHeldForHeadwayWhileTrackIsOccupied() {
        MetroNetwork network = threeStationNetwork();
        TickContext ctx = contextFor(network);
        // Both trains start dwelling at A and will have their dwell expire on the same tick.
        SimulationState state = initialState(trainAt(1, "T1", 1), trainAt(2, "T2", 1));
        List<SimulationEvent> events = new ArrayList<>();

        for (int i = 0; i < 32; i++) {
            state = tick(state, ctx, events);
        }

        List<TrainState> trains = state.trains();
        long departingOrRunning = trains.stream()
                .filter(t -> t.status() == TrainStatus.DEPARTING || t.status() == TrainStatus.RUNNING)
                .count();
        long held = trains.stream()
                .filter(t -> t.status() == TrainStatus.STOPPED || t.status() == TrainStatus.DELAYED)
                .count();

        // Exactly one of the two claims the single-block track; the other must not also be on it.
        assertThat(departingOrRunning).isEqualTo(1);
        assertThat(held).isEqualTo(1);
        assertThat(events.stream().anyMatch(e -> e.type() == EventType.HELD_FOR_HEADWAY)).isTrue();

        // The A->B block's signal reflects the one train that claimed it (never GREEN with someone
        // on it); the untouched B->C block's signal is still GREEN/FREE.
        Signal blockAB = signalForTrack(state, 1L);
        assertThat(blockAB.aspect()).isIn(SignalAspect.YELLOW, SignalAspect.RED);
        assertThat(blockAB.blockState()).isIn(BlockState.RESERVED, BlockState.OCCUPIED);
        assertThat(blockAB.controllingTrainId()).isNotNull();

        Signal blockBC = signalForTrack(state, 2L);
        assertThat(blockBC.aspect()).isEqualTo(SignalAspect.GREEN);
        assertThat(blockBC.blockState()).isEqualTo(BlockState.FREE);
        assertThat(blockBC.controllingTrainId()).isNull();
    }

    private static Signal signalForTrack(SimulationState state, long trackId) {
        return state.signals().stream()
                .filter(s -> s.trackId() == trackId)
                .findFirst()
                .orElseThrow(() -> new AssertionError("No signal found for track " + trackId));
    }

    @Test
    void sameInitialStateAndSeedProducesIdenticalTrajectory() {
        MetroNetwork network = threeStationNetwork();
        TickContext ctxA = contextFor(network);
        TickContext ctxB = contextFor(threeStationNetwork()); // independently-built but identical network

        SimulationState stateA = initialState(trainAt(1, "T1", 1), trainAt(2, "T2", 1));
        SimulationState stateB = initialState(trainAt(1, "T1", 1), trainAt(2, "T2", 1));
        List<SimulationEvent> eventsA = new ArrayList<>();
        List<SimulationEvent> eventsB = new ArrayList<>();

        for (int i = 0; i < 120; i++) {
            stateA = tick(stateA, ctxA, eventsA);
            stateB = tick(stateB, ctxB, eventsB);
            assertThat(stateA).isEqualTo(stateB);
        }

        assertThat(eventsA).isEqualTo(eventsB);
    }
}
