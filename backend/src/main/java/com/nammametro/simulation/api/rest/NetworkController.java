package com.nammametro.simulation.api.rest;

import com.nammametro.simulation.api.rest.dto.LineResponse;
import com.nammametro.simulation.api.rest.dto.StationResponse;
import com.nammametro.simulation.api.rest.dto.TrackResponse;
import com.nammametro.simulation.application.port.in.NetworkQueryUseCase;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/network")
public class NetworkController {

    private final NetworkQueryUseCase networkQueryUseCase;

    public NetworkController(NetworkQueryUseCase networkQueryUseCase) {
        this.networkQueryUseCase = networkQueryUseCase;
    }

    @GetMapping("/lines")
    public List<LineResponse> getLines() {
        return networkQueryUseCase.getAllLines().stream().map(LineResponse::from).toList();
    }

    @GetMapping("/lines/{code}")
    public LineResponse getLine(@PathVariable String code) {
        return LineResponse.from(networkQueryUseCase.getLineByCode(code));
    }

    @GetMapping("/stations")
    public List<StationResponse> getStations() {
        return networkQueryUseCase.getAllStations().stream().map(StationResponse::from).toList();
    }

    @GetMapping("/stations/{code}")
    public StationResponse getStation(@PathVariable String code) {
        return StationResponse.from(networkQueryUseCase.getStationByCode(code));
    }

    @GetMapping("/tracks")
    public List<TrackResponse> getTracks() {
        return networkQueryUseCase.getAllTracks().stream().map(TrackResponse::from).toList();
    }
}
