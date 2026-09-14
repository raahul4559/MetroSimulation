package com.nammametro.simulation.trainsim.infrastructure;

import com.nammametro.simulation.application.port.out.SimulationConfigRepository;
import com.nammametro.simulation.application.port.out.TrainRepository;
import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.domain.model.SimulationConfig;
import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.domain.model.Train;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Builds a fresh {@link SimulationState} + {@link EngineSettings} from the persisted, read-only
 * inputs: the train roster and active config in Postgres (see {@code database/README.md}), and the
 * real station/line/track topology in {@link MetroNetwork} (see {@code data/README.md}). Every
 * train starts {@link TrainStatus#AT_STATION} at the first stop of its configured direction.
 *
 * <p>Called once at startup and again on every {@code reset()} — same inputs, same result, by
 * construction (nothing here reads wall-clock time or mutates its sources).
 */
@Component
public class TrainRosterAssembler {

    private final MetroNetwork network;
    private final TrainRepository trainRepository;
    private final SimulationConfigRepository configRepository;

    public TrainRosterAssembler(MetroNetwork network, TrainRepository trainRepository,
                                 SimulationConfigRepository configRepository) {
        this.network = network;
        this.trainRepository = trainRepository;
        this.configRepository = configRepository;
    }

    public Assembled assemble() {
        SimulationConfig config = configRepository.findActive()
                .orElseThrow(() -> new ResourceNotFoundException("SimulationConfig", "active"));

        EngineSettings settings = new EngineSettings(
                config.baseSimSecondsPerTick(), config.headwaySeconds(),
                config.delayThresholdSeconds(), config.randomSeed());

        SimulationClock clock = new SimulationClock(
                config.startTime(), SimulationStatus.STOPPED,
                SimulationSpeed.fromMultiplier(config.timeScale()), 0, 0);

        List<TrainState> trains = trainRepository.findAll().stream()
                .map(this::initialTrainState)
                .toList();

        return new Assembled(new SimulationState(clock, trains), settings);
    }

    private TrainState initialTrainState(Train train) {
        Line line = network.findLineByCode(train.lineCode())
                .orElseThrow(() -> new ResourceNotFoundException("Line", train.lineCode()));
        Station origin = routeStations(line, train.direction()).get(0);

        return new TrainState(
                train.id(), train.code(), train.lineCode(), train.direction(),
                null, origin.id(), origin.id(),
                0, 0, TrainStatus.AT_STATION,
                0, train.capacity(), 0, 0);
    }

    private List<Station> routeStations(Line line, TrainDirection direction) {
        if (direction == TrainDirection.OUTBOUND) {
            return line.orderedStations();
        }
        List<Station> reversed = new ArrayList<>(line.orderedStations());
        Collections.reverse(reversed);
        return reversed;
    }

    public record Assembled(SimulationState initialState, EngineSettings settings) {
    }
}
