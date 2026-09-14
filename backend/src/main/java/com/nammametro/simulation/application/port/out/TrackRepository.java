package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.Track;

import java.util.List;

public interface TrackRepository {

    List<Track> findAll();

    List<Track> findByLineId(Long lineId);
}
