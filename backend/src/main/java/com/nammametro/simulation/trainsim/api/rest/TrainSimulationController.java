package com.nammametro.simulation.trainsim.api.rest;

import com.nammametro.simulation.trainsim.api.rest.dto.SimulationClockResponse;
import com.nammametro.simulation.trainsim.api.rest.dto.SimulationStateResponse;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The discrete-time simulation engine's API — un-versioned, alongside {@code /api/metro}. Distinct
 * from the older, still-independent tick clock at {@code /api/v1/simulation}.
 */
@RestController
@RequestMapping("/api/simulation")
public class TrainSimulationController {

    private final TrainSimulationControlUseCase simulation;

    public TrainSimulationController(TrainSimulationControlUseCase simulation) {
        this.simulation = simulation;
    }

    @PostMapping("/start")
    public SimulationStateResponse start() {
        return SimulationStateResponse.from(simulation.start());
    }

    @PostMapping("/pause")
    public SimulationStateResponse pause() {
        return SimulationStateResponse.from(simulation.pause());
    }

    @PostMapping("/stop")
    public SimulationStateResponse stop() {
        return SimulationStateResponse.from(simulation.stop());
    }

    @PostMapping("/reset")
    public SimulationStateResponse reset() {
        return SimulationStateResponse.from(simulation.reset());
    }

    /**
     * Not in the original endpoint list, but necessary to reach the required "support speeds
     * 0.5x/1x/2x/5x/10x/50x" behaviour from outside the process. 400s on any other value.
     */
    @PostMapping("/speed")
    public SimulationStateResponse setSpeed(@RequestParam double value) {
        return SimulationStateResponse.from(simulation.setSpeed(SimulationSpeed.fromMultiplier(value)));
    }

    @GetMapping("/state")
    public SimulationStateResponse getState() {
        return SimulationStateResponse.from(simulation.getState());
    }

    @GetMapping("/time")
    public SimulationClockResponse getTime() {
        return SimulationClockResponse.from(simulation.getClock());
    }
}
