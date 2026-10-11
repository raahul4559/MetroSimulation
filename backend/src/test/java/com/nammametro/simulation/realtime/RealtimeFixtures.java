package com.nammametro.simulation.realtime;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.time.Instant;
import java.util.List;

/** Shared fixtures for the realtime tests: a tiny, hand-checkable network and a simulation stub. */
public final class RealtimeFixtures {

    private RealtimeFixtures() {
    }

    /**
     * Line {@code PURPLE}: A(1) — B(2) — C(3), due east along latitude 12.97, legs of ~1086 m that
     * take 60 s, 30 s dwell everywhere. Outbound is A -> C.
     */
    public static MetroNetwork network() {
        Station a = new Station(1, "A", "Alpha", new Coordinates(12.97, 77.50), List.of("PURPLE"), StationType.TERMINAL, 30);
        Station b = new Station(2, "B", "Bravo", new Coordinates(12.97, 77.51), List.of("PURPLE"), StationType.REGULAR, 30);
        Station c = new Station(3, "C", "Charlie", new Coordinates(12.97, 77.52), List.of("PURPLE"), StationType.TERMINAL, 30);
        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c).forEach(network::addStation);
        network.addLine(new Line(1, "PURPLE", "Purple Line", "#800080", List.of(a, b, c)));
        network.addTrack(new Track(11, "PURPLE", a.id(), b.id(), 1086, 60, List.of()));
        network.addTrack(new Track(12, "PURPLE", b.id(), c.id(), 1086, 60, List.of()));
        return network;
    }

    public static SimulationState simulationState(SimulationStatus status) {
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T00:00:00Z"), status,
                SimulationSpeed.NORMAL, 0, 0);
        return new SimulationState(clock, List.of(), List.of(), List.of(), PassengerMetrics.empty(), List.of());
    }

    /** A read-only simulation stand-in; control methods are never called by the realtime layer. */
    public static TrainSimulationControlUseCase simulation(SimulationState state) {
        return new TrainSimulationControlUseCase() {
            @Override
            public SimulationState getState() {
                return state;
            }

            @Override
            public SimulationClock getClock() {
                return state.clock();
            }

            @Override
            public SimulationState start() {
                throw new UnsupportedOperationException();
            }

            @Override
            public SimulationState pause() {
                throw new UnsupportedOperationException();
            }

            @Override
            public SimulationState stop() {
                throw new UnsupportedOperationException();
            }

            @Override
            public SimulationState reset() {
                throw new UnsupportedOperationException();
            }

            @Override
            public SimulationState setSpeed(SimulationSpeed speed) {
                throw new UnsupportedOperationException();
            }
        };
    }
}
