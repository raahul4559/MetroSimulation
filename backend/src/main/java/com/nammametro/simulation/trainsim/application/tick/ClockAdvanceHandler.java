package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickHandler;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

/** Always runs first in the pipeline — every later handler reads the tick/time it produces. */
public class ClockAdvanceHandler implements TickHandler {

    @Override
    public TickResult handle(SimulationState current, TickContext context) {
        long delta = context.settings().deltaSecondsFor(current.clock().speed());
        return TickResult.noEvents(current.withClock(current.clock().advanced(delta)));
    }
}
