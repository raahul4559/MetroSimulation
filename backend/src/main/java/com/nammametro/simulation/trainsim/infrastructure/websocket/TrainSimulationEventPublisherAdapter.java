package com.nammametro.simulation.trainsim.infrastructure.websocket;

import com.nammametro.simulation.realtime.application.SimulationStatePublishedEvent;
import com.nammametro.simulation.trainsim.api.rest.dto.SimulationEventResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.SimulationStateResponse;
import com.nammametro.simulation.trainsim.application.TrainSimulationEventPublisher;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Broadcasts on two topics, kept separate from the older tick-only {@code /topic/simulation} used
 * by {@code com.nammametro.simulation.api.websocket} (a different, still-independent engine):
 * {@code /topic/train-simulation/state} carries the full continuous state every tick (what the
 * frontend needs for real-time train positions); {@code /topic/train-simulation/events} carries
 * only the discrete, named occurrences (departures, arrivals, holds, completions) from that tick.
 *
 * <p>Every state broadcast is also raised as a {@link SimulationStatePublishedEvent}, so the
 * realtime layer's canonical state ({@code /topic/realtime/state}) publishes in lock-step with
 * the simulation's ticks while the simulation is its active source.
 */
@Component
public class TrainSimulationEventPublisherAdapter implements TrainSimulationEventPublisher {

    private static final String STATE_DESTINATION = "/topic/train-simulation/state";
    private static final String EVENTS_DESTINATION = "/topic/train-simulation/events";

    private final SimpMessagingTemplate messagingTemplate;
    private final ApplicationEventPublisher applicationEvents;

    public TrainSimulationEventPublisherAdapter(SimpMessagingTemplate messagingTemplate,
                                                ApplicationEventPublisher applicationEvents) {
        this.messagingTemplate = messagingTemplate;
        this.applicationEvents = applicationEvents;
    }

    @Override
    public void publishState(SimulationState state) {
        messagingTemplate.convertAndSend(STATE_DESTINATION, SimulationStateResponse.from(state));
        applicationEvents.publishEvent(new SimulationStatePublishedEvent(state));
    }

    @Override
    public void publishEvents(List<SimulationEvent> events) {
        messagingTemplate.convertAndSend(EVENTS_DESTINATION, events.stream().map(SimulationEventResponse::from).toList());
    }
}
