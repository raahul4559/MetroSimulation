package com.nammametro.simulation.application.port.in;

import com.nammametro.simulation.domain.model.Line;
import com.nammametro.simulation.domain.model.Station;
import com.nammametro.simulation.domain.model.Track;

import java.util.List;

public interface NetworkQueryUseCase {

    List<Line> getAllLines();

    Line getLineByCode(String code);

    List<Station> getAllStations();

    Station getStationByCode(String code);

    List<Track> getAllTracks();
}
