package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;

import java.util.Random;

/**
 * Everything a {@link TickHandler} needs besides the current state. {@code random} is seeded once
 * from {@link EngineSettings#randomSeed()} at engine construction/reset — no handler this chunk
 * consumes it (no passenger demand yet), but it's wired through so a future handler can draw from
 * it deterministically without threading a new dependency everywhere.
 */
public record TickContext(MetroNetwork network, EngineSettings settings, Random random) {
}
