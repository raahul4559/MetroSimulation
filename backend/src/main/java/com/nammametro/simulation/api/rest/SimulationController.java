package com.nammametro.simulation.api.rest;

import com.nammametro.simulation.api.rest.dto.SimulationResponse;
import com.nammametro.simulation.application.port.in.SimulationControlUseCase;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/simulation")
public class SimulationController {

    private final SimulationControlUseCase simulationControlUseCase;

    public SimulationController(SimulationControlUseCase simulationControlUseCase) {
        this.simulationControlUseCase = simulationControlUseCase;
    }

    @GetMapping
    public SimulationResponse getState() {
        return SimulationResponse.from(simulationControlUseCase.getState());
    }

    @PostMapping("/start")
    public SimulationResponse start() {
        return SimulationResponse.from(simulationControlUseCase.start());
    }

    @PostMapping("/pause")
    public SimulationResponse pause() {
        return SimulationResponse.from(simulationControlUseCase.pause());
    }

    @PostMapping("/reset")
    public SimulationResponse reset() {
        return SimulationResponse.from(simulationControlUseCase.reset());
    }
}
