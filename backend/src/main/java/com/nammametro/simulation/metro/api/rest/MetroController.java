package com.nammametro.simulation.metro.api.rest;

import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.metro.api.rest.dto.LineResponse;
import com.nammametro.simulation.metro.api.rest.dto.NetworkResponse;
import com.nammametro.simulation.metro.api.rest.dto.RouteResponse;
import com.nammametro.simulation.metro.api.rest.dto.StationResponse;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.metro.routing.DijkstraRouteFinder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/metro")
public class MetroController {

    private final MetroNetwork network;

    public MetroController(MetroNetwork network) {
        this.network = network;
    }

    @GetMapping("/stations")
    public List<StationResponse> getStations() {
        return network.allStations().stream().map(StationResponse::from).toList();
    }

    @GetMapping("/stations/{id}")
    public StationResponse getStation(@PathVariable long id) {
        return network.findStation(id)
                .map(StationResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("Station", String.valueOf(id)));
    }

    @GetMapping("/lines")
    public List<LineResponse> getLines() {
        return network.allLines().stream().map(LineResponse::from).toList();
    }

    @GetMapping("/lines/{id}")
    public LineResponse getLine(@PathVariable long id) {
        return network.findLine(id)
                .map(LineResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("Line", String.valueOf(id)));
    }

    @GetMapping("/network")
    public NetworkResponse getNetwork() {
        return NetworkResponse.from(network);
    }

    @GetMapping("/route")
    public RouteResponse getRoute(@RequestParam long from, @RequestParam long to) {
        return RouteResponse.from(DijkstraRouteFinder.findRoute(network, from, to));
    }
}
