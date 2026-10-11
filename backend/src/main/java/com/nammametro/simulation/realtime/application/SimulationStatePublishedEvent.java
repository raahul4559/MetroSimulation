package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.trainsim.domain.model.SimulationState;

/**
 * Raised whenever the simulation engine broadcasts a new state (every tick, and on reset). Lets
 * {@code MetroStateManager} publish the canonical state in lock-step with the simulation instead
 * of sampling it on its own timer — sampling would alias one-tick states such as
 * {@code AT_STATION}, and the 3D announcements key off exactly those edges.
 */
public record SimulationStatePublishedEvent(SimulationState state) {
}
