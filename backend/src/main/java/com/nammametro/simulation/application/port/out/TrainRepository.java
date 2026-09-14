package com.nammametro.simulation.application.port.out;

import com.nammametro.simulation.domain.model.Train;

import java.util.List;

public interface TrainRepository {

    List<Train> findAll();
}
