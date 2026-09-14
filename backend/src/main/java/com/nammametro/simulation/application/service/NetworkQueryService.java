package com.nammametro.simulation.application.service;

import com.nammametro.simulation.application.port.in.NetworkQueryUseCase;
import com.nammametro.simulation.application.port.out.LineRepository;
import com.nammametro.simulation.application.port.out.StationRepository;
import com.nammametro.simulation.application.port.out.TrackRepository;
import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.domain.model.Line;
import com.nammametro.simulation.domain.model.Station;
import com.nammametro.simulation.domain.model.Track;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class NetworkQueryService implements NetworkQueryUseCase {

    private final LineRepository lineRepository;
    private final StationRepository stationRepository;
    private final TrackRepository trackRepository;

    public NetworkQueryService(LineRepository lineRepository, StationRepository stationRepository,
                                TrackRepository trackRepository) {
        this.lineRepository = lineRepository;
        this.stationRepository = stationRepository;
        this.trackRepository = trackRepository;
    }

    @Override
    public List<Line> getAllLines() {
        return lineRepository.findAll();
    }

    @Override
    public Line getLineByCode(String code) {
        return lineRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Line", code));
    }

    @Override
    public List<Station> getAllStations() {
        return stationRepository.findAll();
    }

    @Override
    public Station getStationByCode(String code) {
        return stationRepository.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Station", code));
    }

    @Override
    public List<Track> getAllTracks() {
        return trackRepository.findAll();
    }
}
