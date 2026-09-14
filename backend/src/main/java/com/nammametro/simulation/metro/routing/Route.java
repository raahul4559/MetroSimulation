package com.nammametro.simulation.metro.routing;

import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;

import java.util.List;

/** An ordered path through the network: {@code stations.size() == tracks.size() + 1}. */
public record Route(
        List<Station> stations,
        List<Track> tracks,
        int totalDistanceMetres,
        int totalTravelTimeSeconds
) {
}
