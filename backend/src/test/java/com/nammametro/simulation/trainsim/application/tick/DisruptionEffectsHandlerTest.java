package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.AffectedResourceType;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.DisruptionSeverity;
import com.nammametro.simulation.trainsim.domain.model.DisruptionStatus;
import com.nammametro.simulation.trainsim.domain.model.DisruptionType;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.EventType;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class DisruptionEffectsHandlerTest {

    private static final DisruptionEffectsHandler HANDLER = new DisruptionEffectsHandler();

    private static SimulationState stateAt(long elapsedSeconds, Disruption... disruptions) {
        SimulationClock clock = new SimulationClock(Instant.parse("2026-01-01T05:00:00Z"),
                SimulationStatus.RUNNING, SimulationSpeed.NORMAL, 0, elapsedSeconds);
        return new SimulationState(clock, List.of(), List.of(), List.of(), PassengerMetrics.empty(),
                List.of(disruptions));
    }

    private static TickContext contextFor() {
        return new TickContext(new MetroNetwork(), new EngineSettings(5, 120, 60, 42), new Random(42));
    }

    private static Disruption scheduled(long startSeconds, int durationSeconds) {
        return new Disruption(1, DisruptionType.TRACK_BLOCKAGE, AffectedResourceType.TRACK, 1, startSeconds,
                durationSeconds, 0, DisruptionSeverity.MAJOR, "Track blockage", DisruptionStatus.SCHEDULED);
    }

    @Test
    void staysScheduledBeforeItsStartTime() {
        SimulationState state = stateAt(50, scheduled(100, 300));
        TickResult result = HANDLER.handle(state, contextFor());

        assertThat(result.state().disruptions().get(0).status()).isEqualTo(DisruptionStatus.SCHEDULED);
        assertThat(result.events()).isEmpty();
    }

    @Test
    void becomesActiveOnceStartTimeIsReachedAndEmitsAnEvent() {
        SimulationState state = stateAt(100, scheduled(100, 300));
        TickResult result = HANDLER.handle(state, contextFor());

        assertThat(result.state().disruptions().get(0).status()).isEqualTo(DisruptionStatus.ACTIVE);
        assertThat(result.events()).hasSize(1);
        assertThat(result.events().get(0).type()).isEqualTo(EventType.DISRUPTION_STARTED);
    }

    @Test
    void becomesResolvedOnceItsDurationElapsesAndEmitsAnEvent() {
        Disruption active = scheduled(100, 300).withStatus(DisruptionStatus.ACTIVE);
        SimulationState state = stateAt(400, active);
        TickResult result = HANDLER.handle(state, contextFor());

        assertThat(result.state().disruptions().get(0).status()).isEqualTo(DisruptionStatus.RESOLVED);
        assertThat(result.events()).hasSize(1);
        assertThat(result.events().get(0).type()).isEqualTo(EventType.DISRUPTION_ENDED);
    }

    @Test
    void staysActiveBeforeItsDurationElapses() {
        Disruption active = scheduled(100, 300).withStatus(DisruptionStatus.ACTIVE);
        SimulationState state = stateAt(250, active);
        TickResult result = HANDLER.handle(state, contextFor());

        assertThat(result.state().disruptions().get(0).status()).isEqualTo(DisruptionStatus.ACTIVE);
        assertThat(result.events()).isEmpty();
    }

    @Test
    void cancelledDisruptionsAreNeverRevivedByTimeBasedTransitions() {
        Disruption cancelled = scheduled(100, 300).withStatus(DisruptionStatus.CANCELLED);
        SimulationState state = stateAt(9_999, cancelled);
        TickResult result = HANDLER.handle(state, contextFor());

        assertThat(result.state().disruptions().get(0).status()).isEqualTo(DisruptionStatus.CANCELLED);
        assertThat(result.events()).isEmpty();
    }

    @Test
    void resolvedDisruptionsStayResolved() {
        Disruption resolved = scheduled(100, 300).withStatus(DisruptionStatus.RESOLVED);
        SimulationState state = stateAt(9_999, resolved);
        TickResult result = HANDLER.handle(state, contextFor());

        assertThat(result.state().disruptions().get(0).status()).isEqualTo(DisruptionStatus.RESOLVED);
        assertThat(result.events()).isEmpty();
    }
}
