package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.DemandProfile;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class PassengerDemandGenerationHandlerTest {

    private static final PassengerDemandGenerationHandler HANDLER = new PassengerDemandGenerationHandler();

    /** A(1) -- B(2) -- C(3), one line, three stations. */
    private static MetroNetwork threeStationNetwork() {
        Station a = new Station(1, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 30);
        Station b = new Station(2, "B", "Station B", new Coordinates(12.91, 77.51), List.of("L1"), StationType.INTERCHANGE, 30);
        Station c = new Station(3, "C", "Station C", new Coordinates(12.92, 77.52), List.of("L1"), StationType.REGULAR, 30);

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b, c)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 1000, 60, List.of()));
        network.addTrack(new Track(2, "L1", b.id(), c.id(), 1000, 60, List.of()));
        return network;
    }

    private static SimulationState emptyState(Instant simTime) {
        SimulationClock clock = new SimulationClock(simTime, SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 0, 0);
        return new SimulationState(clock, List.of(), List.of(), List.of(), PassengerMetrics.empty(), List.of());
    }

    @Test
    void generatesNoPassengersOverAZeroLengthTick() {
        MetroNetwork network = threeStationNetwork();
        // baseSimSecondsPerTick=0 means deltaSecondsFor(...) is always 0 regardless of speed.
        EngineSettings settings = new EngineSettings(0, 120, 60, 42, DemandProfile.AFTERNOON, 1.0);
        TickContext ctx = new TickContext(network, settings, new Random(42));

        SimulationState result = HANDLER.handle(emptyState(Instant.parse("2026-01-01T08:00:00Z")), ctx).state();

        assertThat(result.passengers()).isEmpty();
        assertThat(result.passengerMetrics().totalGenerated()).isZero();
    }

    @Test
    void everyGeneratedPassengerHasAValidRouteAndStartsWaitingAtItsOrigin() {
        MetroNetwork network = threeStationNetwork();
        // Long tick + high demand multiplier to reliably generate at least one passenger deterministically.
        EngineSettings settings = new EngineSettings(600, 120, 60, 42, DemandProfile.MORNING_PEAK, 5.0);
        TickContext ctx = new TickContext(network, settings, new Random(7));

        SimulationState result = HANDLER.handle(emptyState(Instant.parse("2026-01-01T08:00:00Z")), ctx).state();

        assertThat(result.passengers()).isNotEmpty();
        assertThat(result.passengerMetrics().totalGenerated()).isEqualTo(result.passengers().size());

        for (Passenger p : result.passengers()) {
            assertThat(p.status()).isEqualTo(PassengerStatus.WAITING);
            assertThat(p.currentStationId()).isEqualTo(p.originStationId());
            assertThat(p.currentTrainId()).isNull();
            assertThat(p.originStationId()).isNotEqualTo(p.destinationStationId());
            assertThat(p.route().getFirst()).isEqualTo(p.originStationId());
            assertThat(p.route().getLast()).isEqualTo(p.destinationStationId());
            assertThat(p.routeIndex()).isZero();
            assertThat(p.boardingTimeSeconds()).isNull();
            assertThat(p.completionTimeSeconds()).isNull();
        }
    }

    @Test
    void demandIsDeterministicGivenTheSameSeed() {
        MetroNetwork network = threeStationNetwork();
        EngineSettings settings = new EngineSettings(600, 120, 60, 42, DemandProfile.EVENING_PEAK, 3.0);

        SimulationState resultA = HANDLER
                .handle(emptyState(Instant.parse("2026-01-01T18:00:00Z")), new TickContext(network, settings, new Random(99)))
                .state();
        SimulationState resultB = HANDLER
                .handle(emptyState(Instant.parse("2026-01-01T18:00:00Z")), new TickContext(network, settings, new Random(99)))
                .state();

        assertThat(resultA.passengers()).hasSameSizeAs(resultB.passengers());
        assertThat(resultA.passengers().stream().map(Passenger::destinationStationId).toList())
                .isEqualTo(resultB.passengers().stream().map(Passenger::destinationStationId).toList());
    }

    @Test
    void nightProfileGeneratesFewerPassengersThanMorningPeakForTheSameStretch() {
        MetroNetwork network = threeStationNetwork();
        EngineSettings nightSettings = new EngineSettings(3600, 120, 60, 42, DemandProfile.NIGHT, 1.0);
        EngineSettings peakSettings = new EngineSettings(3600, 120, 60, 42, DemandProfile.MORNING_PEAK, 1.0);

        int nightCount = HANDLER
                .handle(emptyState(Instant.parse("2026-01-01T02:00:00Z")), new TickContext(network, nightSettings, new Random(1)))
                .state().passengers().size();
        int peakCount = HANDLER
                .handle(emptyState(Instant.parse("2026-01-01T08:00:00Z")), new TickContext(network, peakSettings, new Random(1)))
                .state().passengers().size();

        assertThat(peakCount).isGreaterThan(nightCount);
    }
}
