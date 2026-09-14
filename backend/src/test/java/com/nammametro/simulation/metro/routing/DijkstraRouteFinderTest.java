package com.nammametro.simulation.metro.routing;

import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.metro.domain.exception.RouteNotFoundException;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DijkstraRouteFinderTest {

    private static Station station(long id, String code) {
        return new Station(id, code, "Station " + code, new Coordinates(12.9 + id * 0.01, 77.5), List.of("L1"), StationType.REGULAR, 30);
    }

    @Test
    void findsTheShortestMultiHopPathByTravelTime() {
        Station a = station(1, "A");
        Station b = station(2, "B");
        Station c = station(3, "C");
        Station d = station(4, "D");

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c, d).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b, c, d)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 1000, 100, List.of()));
        network.addTrack(new Track(2, "L1", b.id(), c.id(), 1000, 100, List.of()));
        network.addTrack(new Track(3, "L1", c.id(), d.id(), 1000, 100, List.of()));

        Route route = DijkstraRouteFinder.findRoute(network, a.id(), d.id());

        assertThat(route.stations()).extracting(Station::code).containsExactly("A", "B", "C", "D");
        assertThat(route.tracks()).hasSize(3);
        assertThat(route.totalTravelTimeSeconds()).isEqualTo(300);
        assertThat(route.totalDistanceMetres()).isEqualTo(3000);
    }

    @Test
    void prefersTheFasterOfTwoPathsEvenIfLonger() {
        Station a = station(1, "A");
        Station b = station(2, "B");
        Station c = station(3, "C");

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, c).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b, c)));
        // Direct A-C is a long, slow track; A-B-C is shorter in time despite two hops.
        network.addTrack(new Track(1, "L1", a.id(), c.id(), 20000, 2000, List.of()));
        network.addTrack(new Track(2, "L1", a.id(), b.id(), 1000, 100, List.of()));
        network.addTrack(new Track(3, "L1", b.id(), c.id(), 1000, 100, List.of()));

        Route route = DijkstraRouteFinder.findRoute(network, a.id(), c.id());

        assertThat(route.stations()).extracting(Station::code).containsExactly("A", "B", "C");
        assertThat(route.totalTravelTimeSeconds()).isEqualTo(200);
    }

    @Test
    void sameStationRouteIsTrivial() {
        Station a = station(1, "A");
        MetroNetwork network = new MetroNetwork();
        network.addStation(a);

        Route route = DijkstraRouteFinder.findRoute(network, a.id(), a.id());

        assertThat(route.stations()).containsExactly(a);
        assertThat(route.tracks()).isEmpty();
        assertThat(route.totalTravelTimeSeconds()).isZero();
    }

    @Test
    void throwsWhenNoPathExistsBetweenDisconnectedComponents() {
        Station a = station(1, "A");
        Station b = station(2, "B");
        Station isolated = station(3, "ISOLATED");

        MetroNetwork network = new MetroNetwork();
        List.of(a, b, isolated).forEach(network::addStation);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 1000, 100, List.of()));

        assertThatThrownBy(() -> DijkstraRouteFinder.findRoute(network, a.id(), isolated.id()))
                .isInstanceOf(RouteNotFoundException.class);
    }

    @Test
    void throwsResourceNotFoundForUnknownStationId() {
        MetroNetwork network = new MetroNetwork();
        network.addStation(station(1, "A"));

        assertThatThrownBy(() -> DijkstraRouteFinder.findRoute(network, 1, 9999))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
