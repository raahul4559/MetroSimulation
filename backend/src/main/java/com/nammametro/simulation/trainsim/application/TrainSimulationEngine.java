package com.nammametro.simulation.trainsim.application;

import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.tick.ClockAdvanceHandler;
import com.nammametro.simulation.trainsim.application.tick.PassengerBoardingHandler;
import com.nammametro.simulation.trainsim.application.tick.PassengerDemandGenerationHandler;
import com.nammametro.simulation.trainsim.application.tick.TrainDispatcher;
import com.nammametro.simulation.trainsim.application.tick.TrainMovementTickHandler;
import com.nammametro.simulation.trainsim.domain.BlockSafetyValidator;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.infrastructure.LineScheduleAssembler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The discrete-time simulation engine. Holds the current {@link SimulationState} in an
 * {@link AtomicReference} and advances it once per {@code @Scheduled} tick by running a fixed,
 * explicitly-ordered pipeline — clock, then dispatch, then passenger demand generation, then
 * passenger boarding/alighting, then train movement — never Spring's implicit bean ordering, so
 * the pipeline order is a decision made in code, not an accident of component scanning. Passenger
 * boarding runs before train movement so it always sees a just-arrived train still
 * {@code AT_STATION}, one tick before that status advances to {@code DWELLING}.
 *
 * <p>Deterministic by construction: every input (network topology, engine settings, initial train
 * roster, random seed) is read once at construction/reset and never mutated by the tick loop
 * itself; the tick loop never reads wall-clock time. Replaying the same number of ticks from a
 * fresh {@link #reset()} always produces the same {@link SimulationState} — see
 * {@code TrainMovementTickHandlerTest} for a test that pins this down.
 */
@Service
public class TrainSimulationEngine implements TrainSimulationControlUseCase {

    private static final Logger log = LoggerFactory.getLogger(TrainSimulationEngine.class);

    private final MetroNetwork network;
    private final LineScheduleAssembler assembler;
    private final TrainSimulationEventPublisher eventPublisher;
    private final List<TickHandler> pipeline =
            List.of(new ClockAdvanceHandler(), new TrainDispatcher(), new PassengerDemandGenerationHandler(),
                    new PassengerBoardingHandler(), new TrainMovementTickHandler());

    private final AtomicReference<SimulationState> state;
    private final AtomicReference<LineScheduleAssembler.Assembled> assembled;
    private final AtomicReference<Random> random;

    public TrainSimulationEngine(MetroNetwork network, LineScheduleAssembler assembler,
                             TrainSimulationEventPublisher eventPublisher) {
        this.network = network;
        this.assembler = assembler;
        this.eventPublisher = eventPublisher;

        LineScheduleAssembler.Assembled initial = assembler.assemble();
        this.assembled = new AtomicReference<>(initial);
        this.state = new AtomicReference<>(initial.initialState());
        this.random = new AtomicReference<>(new Random(initial.settings().randomSeed()));
    }

    @Override
    public SimulationState getState() {
        return state.get();
    }

    @Override
    public SimulationClock getClock() {
        return state.get().clock();
    }

    @Override
    public SimulationState start() {
        return state.updateAndGet(s -> s.withClock(s.clock().withStatus(SimulationStatus.RUNNING)));
    }

    @Override
    public SimulationState pause() {
        return state.updateAndGet(s -> s.withClock(s.clock().withStatus(SimulationStatus.PAUSED)));
    }

    @Override
    public SimulationState stop() {
        return state.updateAndGet(s -> s.withClock(s.clock().withStatus(SimulationStatus.STOPPED)));
    }

    @Override
    public SimulationState reset() {
        LineScheduleAssembler.Assembled fresh = assembler.assemble();
        assembled.set(fresh);
        random.set(new Random(fresh.settings().randomSeed()));
        state.set(fresh.initialState());
        eventPublisher.publishState(fresh.initialState());
        return fresh.initialState();
    }

    @Override
    public SimulationState setSpeed(SimulationSpeed speed) {
        return state.updateAndGet(s -> s.withClock(s.clock().withSpeed(speed)));
    }

    @Scheduled(fixedDelayString = "${simulation.tick-interval-ms:1000}")
    void tick() {
        SimulationState current = state.get();
        if (current.clock().status() != SimulationStatus.RUNNING) {
            return;
        }

        TickContext context = new TickContext(network, assembled.get().settings(), random.get());

        SimulationState result = current;
        List<SimulationEvent> allEvents = new ArrayList<>();
        for (TickHandler handler : pipeline) {
            TickResult stepResult = handler.handle(result, context);
            result = stepResult.state();
            allEvents.addAll(stepResult.events());
        }

        state.set(result);
        eventPublisher.publishState(result);
        if (!allEvents.isEmpty()) {
            eventPublisher.publishEvents(allEvents);
        }

        // Should never fire — pinned down as a passing test (BlockSafetyValidatorTest) rather than
        // just this claim. Kept here too so a real violation is loud in production, not silent.
        List<String> safetyIssues = BlockSafetyValidator.validate(result);
        if (!safetyIssues.isEmpty()) {
            log.warn("Block safety violation(s) at tick {}: {}", result.clock().currentTick(), safetyIssues);
        }
    }
}
