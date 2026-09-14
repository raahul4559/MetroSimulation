package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.Station;

import java.util.List;
import java.util.Optional;

public interface StationRepository {

    List<Station> findAll();

    Optional<Station> findByCode(String code);
}
