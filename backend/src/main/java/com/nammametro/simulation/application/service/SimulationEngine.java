package com.nammametro.simulation.application.service;

import com.nammametro.simulation.application.port.in.SimulationControlUseCase;
import com.nammametro.simulation.application.port.out.SimulationConfigRepository;
import com.nammametro.simulation.application.port.out.SimulationEventPublisher;
import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.domain.model.Simulation;
import com.nammametro.simulation.domain.model.SimulationConfig;
import com.nammametro.simulation.domain.model.SimulationStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Owns the simulation clock. In this foundation chunk the tick loop only advances the clock and
 * broadcasts state — {@link #tickHandlers} is the seam future chunks (movement, dwell, passenger
 * spawn, signalling) plug into; it is empty today.
 */
@Service
public class SimulationEngine implements SimulationControlUseCase {

    private final SimulationConfigRepository configRepository;
    private final SimulationEventPublisher eventPublisher;
    private final List<TickHandler> tickHandlers;
    private final AtomicReference<Simulation> state;

    public SimulationEngine(SimulationConfigRepository configRepository,
                             SimulationEventPublisher eventPublisher,
                             List<TickHandler> tickHandlers) {
        this.configRepository = configRepository;
        this.eventPublisher = eventPublisher;
        this.tickHandlers = tickHandlers;
        this.state = new AtomicReference<>(Simulation.initial(loadActiveConfig()));
    }

    @Override
    public Simulation getState() {
        return state.get();
    }

    @Override
    public Simulation start() {
        return state.updateAndGet(current -> current.withStatus(SimulationStatus.RUNNING));
    }

    @Override
    public Simulation pause() {
        return state.updateAndGet(current -> current.withStatus(SimulationStatus.PAUSED));
    }

    @Override
    public Simulation reset() {
        Simulation fresh = Simulation.initial(loadActiveConfig());
        state.set(fresh);
        eventPublisher.publish(fresh);
        return fresh;
    }

    @Scheduled(fixedDelayString = "${simulation.tick-interval-ms:1000}")
    void tick() {
        Simulation next = state.updateAndGet(this::advanceIfRunning);
        eventPublisher.publish(next);
    }

    private Simulation advanceIfRunning(Simulation current) {
        if (current.status() != SimulationStatus.RUNNING) {
            return current;
        }
        Simulation advanced = current.withNextTick();
        for (TickHandler handler : tickHandlers) {
            advanced = handler.handle(advanced);
        }
        return advanced;
    }

    private SimulationConfig loadActiveConfig() {
        return configRepository.findActive()
                .orElseThrow(() -> new ResourceNotFoundException("SimulationConfig", "active"));
    }
}
