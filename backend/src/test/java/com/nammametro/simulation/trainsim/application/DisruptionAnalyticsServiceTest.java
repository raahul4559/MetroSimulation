package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.trainsim.domain.model.AffectedResourceType;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.DisruptionSeverity;
import com.nammametro.simulation.trainsim.domain.model.DisruptionStatus;
import com.nammametro.simulation.trainsim.domain.model.DisruptionType;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;

class DisruptionAnalyticsServiceTest {

    private static TrainState train(long id, int delaySeconds, int passengerCount) {
        return new TrainState(id, "T" + id, "L1", TrainDirection.OUTBOUND, null, 1, 1, 0, 0,
                TrainStatus.AT_STATION, passengerCount, 200, 0, 0, 0, 30, 36.0, 1.0, 1.2,
                null, null, null, delaySeconds);
    }

    private static Passenger waitingAt(long id, long stationId) {
        return new Passenger(id, stationId, 99, List.of(stationId, 99L), 0, stationId, null,
                PassengerStatus.WAITING, 0, null, null);
    }

    private static SimulationState stateWith(List<TrainState> trains, List<Passenger> passengers,
                                              List<Disruption> disruptions) {
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T05:00:00Z"),
                SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 0, 0);
        return new SimulationState(clock, trains, List.of(), passengers, PassengerMetrics.empty(), disruptions);
    }

    @Test
    void computesTotalsAverageAndMaxOverAllTrains() {
        SimulationState state = stateWith(
                List.of(train(1, 0, 100), train(2, 60, 50), train(3, 120, 80)),
                List.of(), List.of());

        DisruptionAnalyticsService.Analytics analytics = DisruptionAnalyticsService.compute(state);

        assertThat(analytics.totalDelaySeconds()).isEqualTo(180);
        assertThat(analytics.averageDelaySeconds()).isCloseTo(60.0, offset(0.001));
        assertThat(analytics.maxDelaySeconds()).isEqualTo(120);
        assertThat(analytics.affectedTrainsCount()).isEqualTo(2); // delaySeconds > 0
    }

    @Test
    void affectedPassengersCountsRidersOnDelayedTrainsPlusThoseWaitingAtDisruptedStations() {
        Disruption congestion = new Disruption(1, DisruptionType.STATION_CONGESTION, AffectedResourceType.STATION,
                5, 0, 600, 90, DisruptionSeverity.MODERATE, "Congestion", DisruptionStatus.ACTIVE);

        SimulationState state = stateWith(
                List.of(train(1, 30, 40), train(2, 0, 60)),
                List.of(waitingAt(10, 5), waitingAt(11, 5), waitingAt(12, 7)),
                List.of(congestion));

        DisruptionAnalyticsService.Analytics analytics = DisruptionAnalyticsService.compute(state);

        // 40 onboard the one delayed train + 2 waiting at station 5 (station 7 has no active disruption).
        assertThat(analytics.affectedPassengers()).isEqualTo(42);
    }

    @Test
    void returnsZeroesForAnEmptyRoster() {
        DisruptionAnalyticsService.Analytics analytics = DisruptionAnalyticsService.compute(stateWith(List.of(), List.of(), List.of()));

        assertThat(analytics.totalDelaySeconds()).isZero();
        assertThat(analytics.averageDelaySeconds()).isZero();
        assertThat(analytics.maxDelaySeconds()).isZero();
        assertThat(analytics.affectedTrainsCount()).isZero();
        assertThat(analytics.affectedPassengers()).isZero();
    }
}
