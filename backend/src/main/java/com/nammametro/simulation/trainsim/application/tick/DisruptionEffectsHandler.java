package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickHandler;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.DisruptionStatus;
import com.nammametro.simulation.trainsim.domain.model.EventType;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Advances every {@link Disruption}'s lifecycle purely from simulated time: {@code SCHEDULED} to
 * {@code ACTIVE} once the clock reaches {@code startSeconds}, {@code ACTIVE} to {@code RESOLVED}
 * once it reaches {@link Disruption#endSeconds()} — emitting {@code DISRUPTION_STARTED}/
 * {@code DISRUPTION_ENDED} events on each transition. {@code CANCELLED} disruptions (set by
 * {@code DisruptionController} for early cancellation) are left untouched here.
 *
 * <p>This is the entire "recovery" mechanism for the feature: once a disruption is marked
 * {@code RESOLVED}, {@code TrainMovementTickHandler}'s lookups (which read
 * {@code SimulationState#disruptions()} fresh every tick) simply stop finding it {@code ACTIVE} —
 * block occupancy, signals, dwell, and movement all resume on their own on the very next tick. No
 * explicit "restore" step is needed anywhere else.
 *
 * <p>Runs second in {@code TrainSimulationEngine}'s pipeline, right after
 * {@link ClockAdvanceHandler} and before {@link TrainDispatcher} — so a disruption that starts or
 * ends this tick is already reflected before dispatch, boarding, and movement are computed.
 */
public class DisruptionEffectsHandler implements TickHandler {

    @Override
    public TickResult handle(SimulationState current, TickContext context) {
        long nowSeconds = current.clock().elapsedSimulationSeconds();
        long tick = current.clock().currentTick();
        Instant simTime = current.clock().currentTime();

        List<Disruption> updated = new ArrayList<>();
        List<SimulationEvent> events = new ArrayList<>();

        for (Disruption disruption : current.disruptions()) {
            switch (disruption.status()) {
                case SCHEDULED -> {
                    if (nowSeconds >= disruption.startSeconds()) {
                        Disruption started = disruption.withStatus(DisruptionStatus.ACTIVE);
                        updated.add(started);
                        events.add(event(tick, simTime, EventType.DISRUPTION_STARTED, started));
                    } else {
                        updated.add(disruption);
                    }
                }
                case ACTIVE -> {
                    if (nowSeconds >= disruption.endSeconds()) {
                        Disruption resolved = disruption.withStatus(DisruptionStatus.RESOLVED);
                        updated.add(resolved);
                        events.add(event(tick, simTime, EventType.DISRUPTION_ENDED, resolved));
                    } else {
                        updated.add(disruption);
                    }
                }
                case RESOLVED, CANCELLED -> updated.add(disruption);
            }
        }

        return new TickResult(current.withDisruptions(updated), events);
    }

    private SimulationEvent event(long tick, Instant simTime, EventType type, Disruption disruption) {
        return new SimulationEvent(tick, simTime, type, disruption.resourceId(), disruption.type().name(),
                disruption.resourceType() == com.nammametro.simulation.trainsim.domain.model.AffectedResourceType.STATION
                        ? disruption.resourceId() : null,
                "%s %s (%s, %s)".formatted(disruption.type(),
                        disruption.status() == DisruptionStatus.ACTIVE ? "started" : "ended",
                        disruption.severity(), disruption.description()));
    }
}
