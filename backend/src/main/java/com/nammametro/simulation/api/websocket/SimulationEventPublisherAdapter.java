package com.nammametro.simulation.api.websocket;

import com.nammametro.simulation.application.port.out.SimulationEventPublisher;
import com.nammametro.simulation.domain.model.Simulation;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class SimulationEventPublisherAdapter implements SimulationEventPublisher {

    private static final String DESTINATION = "/topic/simulation";

    private final SimpMessagingTemplate messagingTemplate;

    public SimulationEventPublisherAdapter(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public void publish(Simulation simulation) {
        messagingTemplate.convertAndSend(DESTINATION, SimulationStateMessage.from(simulation));
    }
}
