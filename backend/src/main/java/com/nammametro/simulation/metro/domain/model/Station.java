package com.nammametro.simulation.metro.domain.model;

import com.nammametro.simulation.domain.model.Coordinates;

import java.util.List;

/**
 * A node in the metro network graph. {@code lineCodes} and {@code type} are derived from line
 * membership at load time (see {@code MetroNetworkAssembler}), not authored directly in the dataset.
 */
public record Station(
        long id,
        String code,
        String name,
        Coordinates coordinates,
        List<String> lineCodes,
        StationType type,
        int dwellTimeSeconds
) {
}
