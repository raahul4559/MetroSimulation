package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.LineSchedule;

import java.util.List;

public interface LineScheduleRepository {

    List<LineSchedule> findAll();
}
