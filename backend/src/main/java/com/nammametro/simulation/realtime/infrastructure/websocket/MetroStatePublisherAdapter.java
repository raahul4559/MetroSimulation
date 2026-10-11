package com.nammametro.simulation.realtime.infrastructure.websocket;

import com.nammametro.simulation.realtime.api.rest.dto.MetroStateResponse;
import com.nammametro.simulation.realtime.application.MetroStatePublisher;
import com.nammametro.simulation.realtime.domain.MetroState;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Broadcasts the canonical state on {@code /topic/realtime/state} — the one topic the frontend
 * renders trains from. The simulation's own {@code /topic/train-simulation/*} topics are unchanged
 * and still published, for anything that consumes them directly.
 */
@Component
public class MetroStatePublisherAdapter implements MetroStatePublisher {

    static final String STATE_DESTINATION = "/topic/realtime/state";

    private final SimpMessagingTemplate messagingTemplate;

    public MetroStatePublisherAdapter(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public void publish(MetroState state) {
        messagingTemplate.convertAndSend(STATE_DESTINATION, MetroStateResponse.from(state));
    }
}
