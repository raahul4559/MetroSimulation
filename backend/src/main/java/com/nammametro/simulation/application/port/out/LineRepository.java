package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.Line;

import java.util.List;
import java.util.Optional;

public interface LineRepository {

    List<Line> findAll();

    Optional<Line> findByCode(String code);
}
