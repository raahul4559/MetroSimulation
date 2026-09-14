package com.nammametro.simulation.metro.network;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.domain.model.Track;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class MetroNetworkValidationTest {

    @Test
    void detectsEachKindOfIssueInABrokenNetwork() {
        Station a = new Station(1, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 60);
        Station b = new Station(2, "B", "Station B", new Coordinates(12.91, 77.51), List.of("L1"), StationType.TERMINAL, 60);
        Station bDuplicateId = new Station(2, "B2", "Duplicate id station", new Coordinates(12.91, 77.51), List.of(), StationType.REGULAR, 30);
        Station missingCoords = new Station(3, "C", "Station C", new Coordinates(0.0, 0.0), List.of("L2"), StationType.TERMINAL, 60);
        Station implausibleCoords = new Station(4, "D", "Station D", new Coordinates(50.0, 50.0), List.of("L1"), StationType.REGULAR, 30);

        MetroNetwork network = new MetroNetwork();
        network.addStation(a);
        network.addStation(b);
        network.addStation(bDuplicateId);
        network.addStation(missingCoords);
        network.addStation(implausibleCoords);

        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b)));
        network.addLine(new Line(2, "L2", "Line Two", "#000000", List.of(missingCoords))); // < 2 stations

        network.addTrack(new Track(1, "L1", a.id(), b.id(), 1000, 100, List.of()));       // valid
        network.addTrack(new Track(2, "L1", a.id(), a.id(), 500, 50, List.of()));         // self-loop
        network.addTrack(new Track(3, "L1", a.id(), b.id(), 1000, 100, List.of()));       // duplicate of track 1
        network.addTrack(new Track(4, "L1", missingCoords.id(), 9999, 500, 50, List.of())); // unknown station 9999
        network.addTrack(new Track(5, "L1", implausibleCoords.id(), a.id(), -100, 50, List.of())); // negative distance

        NetworkValidationResult result = network.validate();

        Set<String> errorCodes = result.errors().stream().map(ValidationIssue::code).collect(Collectors.toSet());
        Set<String> warningCodes = result.warnings().stream().map(ValidationIssue::code).collect(Collectors.toSet());

        assertThat(result.hasErrors()).isTrue();
        assertThat(errorCodes).contains(
                "DUPLICATE_STATION_ID",
                "MISSING_COORDINATES",
                "INVALID_LINE_ORDERING",
                "BROKEN_TRACK",
                "DUPLICATE_TRACK",
                "INVALID_STATION_REFERENCE"
        );
        assertThat(warningCodes).contains("IMPLAUSIBLE_COORDINATES");
    }

    @Test
    void wellFormedNetworkValidatesWithNoErrors() {
        Station a = new Station(1, "A", "Station A", new Coordinates(12.90, 77.50), List.of("L1"), StationType.TERMINAL, 60);
        Station b = new Station(2, "B", "Station B", new Coordinates(12.95, 77.55), List.of("L1"), StationType.TERMINAL, 60);

        MetroNetwork network = new MetroNetwork();
        network.addStation(a);
        network.addStation(b);
        network.addLine(new Line(1, "L1", "Line One", "#FFFFFF", List.of(a, b)));
        network.addTrack(new Track(1, "L1", a.id(), b.id(), 1000, 100, List.of()));

        NetworkValidationResult result = network.validate();

        assertThat(result.hasErrors()).isFalse();
        assertThat(result.issues()).isEmpty();
    }
}
