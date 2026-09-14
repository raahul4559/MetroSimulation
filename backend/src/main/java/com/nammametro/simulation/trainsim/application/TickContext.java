package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;

import java.util.Random;

/**
 * Everything a {@link TickHandler} needs besides the current state. {@code random} is seeded once
 * from {@link EngineSettings#randomSeed()} at engine construction/reset — consumed by
 * {@code PassengerDemandGenerationHandler} for demand sampling and destination selection, the same
 * seeded stream every replay draws from, deterministically.
 */
public record TickContext(MetroNetwork network, EngineSettings settings, Random random) {
}
