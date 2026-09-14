package com.nammametro.simulation.trainsim.domain.model;

import java.util.List;

/**
 * Everything {@code GET /api/simulation/state} answers with: the clock, every train's position,
 * every block's signal, every active passenger, and cumulative passenger metrics. {@code signals}
 * is fully derived from {@code trains} + the network topology (see {@code TrainMovementTickHandler})
 * — not independent state, just like {@code TrainState} itself is derived fresh each tick rather
 * than mutated in place. {@code passengers} holds only <em>active</em> (not yet {@code COMPLETED})
 * riders — a completed passenger's stats are folded into {@code passengerMetrics} and the record
 * itself dropped, so the roster stays bounded by how many people are currently mid-journey, not by
 * how long the simulation has been running.
 */
public record SimulationState(SimulationClock clock, List<TrainState> trains, List<Signal> signals,
                               List<Passenger> passengers, PassengerMetrics passengerMetrics) {

    public SimulationState withClock(SimulationClock newClock) {
        return new SimulationState(newClock, trains, signals, passengers, passengerMetrics);
    }

    public SimulationState withTrains(List<TrainState> newTrains) {
        return new SimulationState(clock, newTrains, signals, passengers, passengerMetrics);
    }

    public SimulationState withSignals(List<Signal> newSignals) {
        return new SimulationState(clock, trains, newSignals, passengers, passengerMetrics);
    }

    public SimulationState withPassengers(List<Passenger> newPassengers) {
        return new SimulationState(clock, trains, signals, newPassengers, passengerMetrics);
    }

    public SimulationState withPassengerMetrics(PassengerMetrics newMetrics) {
        return new SimulationState(clock, trains, signals, passengers, newMetrics);
    }
}
