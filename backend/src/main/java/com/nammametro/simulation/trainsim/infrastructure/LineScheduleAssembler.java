package com.nammametro.simulation.trainsim.infrastructure;

import com.nammametro.simulation.application.port.out.LineScheduleRepository;
import com.nammametro.simulation.application.port.out.SimulationConfigRepository;
import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.domain.model.LineSchedule;
import com.nammametro.simulation.domain.model.SimulationConfig;
import com.nammametro.simulation.domain.model.SimulationStatus;
import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.domain.model.DemandProfile;
import com.nammametro.simulation.trainsim.domain.model.EngineSettings;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.Signal;
import com.nammametro.simulation.trainsim.domain.model.SimulationClock;
import com.nammametro.simulation.trainsim.domain.model.SimulationSpeed;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds a fresh {@link SimulationState} + {@link EngineSettings} from the persisted, read-only
 * inputs: each line's {@link LineSchedule} (first/last departure, headway, train count — the
 * timetable an operator authors, see {@code database/README.md}) and the active
 * {@code simulation_config}, cross-referenced into the real station/line/track topology in
 * {@link MetroNetwork} (see {@code data/README.md}). Every generated train starts
 * {@link TrainStatus#SCHEDULED} — {@code TrainDispatcher} is what releases it into service once the
 * clock reaches its {@code scheduledDepartureSeconds}.
 *
 * <p>Called once at startup and again on every {@code reset()} — same inputs, same result, by
 * construction (nothing here reads wall-clock time or mutates its sources). This is the "creating
 * scheduled trains" half of dispatching; {@code TrainDispatcher} is the "starting them at their
 * scheduled time, maintaining headway" half.
 */
@Component
public class LineScheduleAssembler {

    private final MetroNetwork network;
    private final LineScheduleRepository scheduleRepository;
    private final SimulationConfigRepository configRepository;

    public LineScheduleAssembler(MetroNetwork network, LineScheduleRepository scheduleRepository,
                                  SimulationConfigRepository configRepository) {
        this.network = network;
        this.scheduleRepository = scheduleRepository;
        this.configRepository = configRepository;
    }

    public Assembled assemble() {
        SimulationConfig config = configRepository.findActive()
                .orElseThrow(() -> new ResourceNotFoundException("SimulationConfig", "active"));

        EngineSettings settings = new EngineSettings(
                config.baseSimSecondsPerTick(), config.headwaySeconds(),
                config.delayThresholdSeconds(), config.randomSeed(),
                DemandProfile.valueOf(config.demandProfileMode()), config.demandMultiplier());

        SimulationClock clock = new SimulationClock(
                config.startTime(), SimulationStatus.STOPPED,
                SimulationSpeed.fromMultiplier(config.timeScale()), 0, 0);

        List<LineSchedule> schedules = scheduleRepository.findAll().stream()
                .sorted(Comparator.comparing(LineSchedule::lineId).thenComparing(LineSchedule::direction))
                .toList();

        List<TrainState> trains = new ArrayList<>();
        Map<String, Integer> sequenceByLineCode = new HashMap<>();
        for (LineSchedule schedule : schedules) {
            trains.addAll(expand(schedule, sequenceByLineCode));
        }

        List<Signal> signals = network.allTracks().stream().map(track -> Signal.free(track.id())).toList();
        SimulationState initial = new SimulationState(clock, trains, signals, List.of(), PassengerMetrics.empty(),
                List.of());
        return new Assembled(initial, settings);
    }

    private List<TrainState> expand(LineSchedule schedule, Map<String, Integer> sequenceByLineCode) {
        validateConsistency(schedule);

        Line line = network.findLineByCode(schedule.lineCode())
                .orElseThrow(() -> new ResourceNotFoundException("Line", schedule.lineCode()));
        Station origin = routeStations(line, schedule.direction()).get(0);
        String codePrefix = schedule.lineCode().substring(0, 1).toUpperCase();

        List<TrainState> generated = new ArrayList<>(schedule.trainCount());
        for (int i = 0; i < schedule.trainCount(); i++) {
            int sequence = sequenceByLineCode.merge(schedule.lineCode(), 1, Integer::sum);
            long departureSeconds = schedule.firstDepartureSeconds() + (long) i * schedule.headwaySeconds();
            long trainId = schedule.id() * 1000L + i;
            String code = "%s%02d".formatted(codePrefix, sequence);

            generated.add(new TrainState(
                    trainId, code, schedule.lineCode(), schedule.direction(), null,
                    origin.id(), origin.id(), 0, 0, TrainStatus.SCHEDULED,
                    0, schedule.capacity(), 0, 0,
                    departureSeconds, schedule.dwellTimeSeconds(), schedule.maxSpeedKmph(),
                    schedule.accelerationMps2(), schedule.brakingRateMps2()));
        }
        return generated;
    }

    private void validateConsistency(LineSchedule schedule) {
        long expectedLast = schedule.firstDepartureSeconds()
                + (long) schedule.headwaySeconds() * (schedule.trainCount() - 1);
        if (expectedLast != schedule.lastDepartureSeconds()) {
            throw new IllegalStateException(
                    "Line schedule %d (%s/%s) is inconsistent: firstDeparture=%d + headway=%d * (count=%d - 1) = %d, but lastDeparture=%d"
                            .formatted(schedule.id(), schedule.lineCode(), schedule.direction(),
                                    schedule.firstDepartureSeconds(), schedule.headwaySeconds(), schedule.trainCount(),
                                    expectedLast, schedule.lastDepartureSeconds()));
        }
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
