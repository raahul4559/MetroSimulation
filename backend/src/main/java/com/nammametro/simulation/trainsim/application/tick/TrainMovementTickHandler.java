package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickHandler;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.EventType;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Advances every train by one tick: dwell countdown, headway-gated departure, continuous progress
 * along the current track under real accel/cruise/brake kinematics, and arrival handling.
 * Occupancy is read from the SNAPSHOT of {@code current} taken before any train in this tick is
 * updated, so the result is independent of train iteration order — a determinism requirement, not
 * just tidiness. {@link TrainStatus#SCHEDULED} trains are untouched here — releasing them into
 * service is {@code TrainDispatcher}'s job, earlier in the pipeline.
 */
public class TrainMovementTickHandler implements TickHandler {

    @Override
    public TickResult handle(SimulationState current, TickContext context) {
        long delta = context.settings().deltaSecondsFor(current.clock().speed());
        long tick = current.clock().currentTick();
        Instant simTime = current.clock().currentTime();

        // Mutable and updated as trains are processed (in fixed roster order) so two trains whose
        // dwell expires in the SAME tick can't both claim the same track — the second sees the
        // first's claim. Order-dependent, but deterministically so: roster order is a fixed input.
        Set<Long> occupiedTracks = new HashSet<>(occupiedTrackIdsFromPriorTicks(current.trains()));

        List<TrainState> updated = new ArrayList<>();
        List<SimulationEvent> events = new ArrayList<>();

        for (TrainState train : current.trains()) {
            StepResult step = advance(train, delta, context, tick, simTime, occupiedTracks);
            if (step.train().status() == TrainStatus.DEPARTING) {
                occupiedTracks.add(step.train().currentTrackId());
            }
            updated.add(step.train());
            events.addAll(step.events());
        }

        return new TickResult(current.withTrains(updated), events);
    }

    private Set<Long> occupiedTrackIdsFromPriorTicks(List<TrainState> trains) {
        return trains.stream()
                .filter(t -> t.status() == TrainStatus.DEPARTING || t.status() == TrainStatus.RUNNING
                        || t.status() == TrainStatus.ARRIVING)
                .map(TrainState::currentTrackId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private StepResult advance(TrainState train, long delta, TickContext ctx, long tick, Instant simTime,
                                Set<Long> occupiedTracks) {
        MetroNetwork network = ctx.network();

        return switch (train.status()) {
            case SCHEDULED, COMPLETED -> StepResult.unchanged(train);

            case AT_STATION -> {
                Station station = network.findStation(train.previousStationId()).orElseThrow();
                yield StepResult.of(
                        withDwellStatus(train, train.dwellTimeSeconds()),
                        event(tick, simTime, EventType.DWELL_STARTED, train, station.id(),
                                "%s began dwelling at %s".formatted(train.code(), station.name())));
            }

            case DWELLING -> {
                int remaining = train.dwellRemainingSeconds() - (int) delta;
                if (remaining > 0) {
                    yield StepResult.unchanged(withDwellRemaining(train, remaining));
                }
                yield handleDwellExpiry(train, ctx, tick, simTime, occupiedTracks);
            }

            case STOPPED, DELAYED -> tryDepart(train, ctx, tick, simTime, occupiedTracks, (int) delta);

            case DEPARTING -> {
                Track track = network.getSingleTrackBetween(train.previousStationId(), train.nextStationId())
                        .orElseThrow();
                yield StepResult.of(advanceAlongTrack(train, track, delta),
                        event(tick, simTime, EventType.DEPARTED, train, train.previousStationId(),
                                "%s departed toward %s".formatted(train.code(), stationName(network, train.nextStationId()))));
            }

            case RUNNING -> {
                Track track = network.getSingleTrackBetween(train.previousStationId(), train.nextStationId())
                        .orElseThrow();
                yield StepResult.unchanged(advanceAlongTrack(train, track, delta));
            }

            case ARRIVING -> {
                Station arrivedAt = network.findStation(train.nextStationId()).orElseThrow();
                yield StepResult.of(
                        atStation(train, arrivedAt.id()),
                        event(tick, simTime, EventType.ARRIVED, train, arrivedAt.id(),
                                "%s arrived at %s".formatted(train.code(), arrivedAt.name())));
            }
        };
    }

    /**
     * One tick of real kinematics along the train's current track: accelerate toward
     * {@code maxSpeedKmph} unless the remaining distance is inside the braking distance needed to
     * stop at the platform ({@code v^2 / (2 * brakingRateMps2)}), in which case decelerate instead —
     * the standard "always look ahead to the stop point" trapezoidal-profile controller. Distance
     * covered this tick is the trapezoidal average of the speed at the start and end of the tick,
     * which is exact for constant acceleration and a good approximation across the accel/brake
     * transition. Never overshoots the platform: progress clamps at 1.0 and the train becomes
     * {@link TrainStatus#ARRIVING} instead.
     */
    private TrainState advanceAlongTrack(TrainState train, Track track, long delta) {
        double trackLengthMetres = track.distanceMetres();
        double distanceIntoTrack = train.progress() * trackLengthMetres;
        double remaining = trackLengthMetres - distanceIntoTrack;

        double v0 = train.speedKmph() / 3.6;
        double maxSpeed = train.maxSpeedKmph() / 3.6;
        double brakingDistance = (v0 * v0) / (2 * train.brakingRateMps2());

        double v1 = remaining <= brakingDistance
                ? Math.max(0, v0 - train.brakingRateMps2() * delta)
                : Math.min(maxSpeed, v0 + train.accelerationMps2() * delta);

        double distanceThisTick = (v0 + v1) / 2.0 * delta;
        double newDistanceIntoTrack = Math.min(trackLengthMetres, distanceIntoTrack + distanceThisTick);
        double newProgress = trackLengthMetres > 0 ? newDistanceIntoTrack / trackLengthMetres : 1.0;

        if (newProgress >= 1.0) {
            return arriving(train, track);
        }
        return withStatus(train, TrainStatus.RUNNING, train.previousStationId(), train.nextStationId(), track.id(),
                newProgress, v1 * 3.6, 0);
    }

    private StepResult handleDwellExpiry(TrainState train, TickContext ctx, long tick, Instant simTime,
                                          Set<Long> occupiedTracks) {
        Long nextId = nextStationAfter(train, ctx.network());
        if (nextId == null) {
            TrainState completed = withStatus(train, TrainStatus.COMPLETED, train.previousStationId(),
                    train.previousStationId(), null, 0, 0, 0);
            return StepResult.of(completed, event(tick, simTime, EventType.ROUTE_COMPLETED, train,
                    train.previousStationId(), "%s completed its route".formatted(train.code())));
        }

        TrainState pendingDeparture = withStatus(train, TrainStatus.DWELLING, train.previousStationId(), nextId,
                null, 0, 0, 0);
        return tryDepart(pendingDeparture, ctx, tick, simTime, occupiedTracks, 0);
    }

    private StepResult tryDepart(TrainState train, TickContext ctx, long tick, Instant simTime,
                                  Set<Long> occupiedTracks, int extraHeldSeconds) {
        Track track = ctx.network().getSingleTrackBetween(train.previousStationId(), train.nextStationId())
                .orElseThrow();

        if (!occupiedTracks.contains(track.id())) {
            TrainState departing = withStatus(train, TrainStatus.DEPARTING, train.previousStationId(),
                    train.nextStationId(), track.id(), 0, 0, 0);
            return StepResult.unchanged(departing);
        }

        int heldSeconds = train.heldSeconds() + extraHeldSeconds;
        boolean delayed = heldSeconds >= ctx.settings().delayThresholdSeconds();
        TrainStatus status = delayed ? TrainStatus.DELAYED : TrainStatus.STOPPED;
        TrainState held = withStatus(train, status, train.previousStationId(), train.nextStationId(), null, 0, 0,
                heldSeconds);

        EventType type = delayed ? EventType.DELAYED : EventType.HELD_FOR_HEADWAY;
        String message = "%s held at %s for headway (%ds)"
                .formatted(train.code(), stationName(ctx.network(), train.previousStationId()), heldSeconds);
        return StepResult.of(held, event(tick, simTime, type, train, train.previousStationId(), message));
    }

    private Long nextStationAfter(TrainState train, MetroNetwork network) {
        Line line = network.findLineByCode(train.lineCode()).orElseThrow();
        List<Station> route = routeStations(line, train.direction());
        int index = indexOf(route, train.previousStationId());
        return index + 1 < route.size() ? route.get(index + 1).id() : null;
    }

    private List<Station> routeStations(Line line, TrainDirection direction) {
        if (direction == TrainDirection.OUTBOUND) {
            return line.orderedStations();
        }
        List<Station> reversed = new ArrayList<>(line.orderedStations());
        Collections.reverse(reversed);
        return reversed;
    }

    private int indexOf(List<Station> stations, long stationId) {
        for (int i = 0; i < stations.size(); i++) {
            if (stations.get(i).id() == stationId) {
                return i;
            }
        }
        throw new IllegalStateException("Station " + stationId + " is not on this train's route");
    }

    private String stationName(MetroNetwork network, long stationId) {
        return network.findStation(stationId).map(Station::name).orElse("?");
    }

    private TrainState arriving(TrainState train, Track track) {
        return withStatus(train, TrainStatus.ARRIVING, train.previousStationId(), train.nextStationId(), track.id(),
                1.0, 0, 0);
    }

    private TrainState atStation(TrainState train, long arrivedStationId) {
        return withStatus(train, TrainStatus.AT_STATION, arrivedStationId, arrivedStationId, null, 0, 0, 0);
    }

    private TrainState withDwellStatus(TrainState train, int dwellRemainingSeconds) {
        TrainState base = withStatus(train, TrainStatus.DWELLING, train.previousStationId(), train.nextStationId(),
                null, 0, 0, 0);
        return withDwellRemaining(base, dwellRemainingSeconds);
    }

    private TrainState withDwellRemaining(TrainState train, int dwellRemainingSeconds) {
        return new TrainState(train.id(), train.code(), train.lineCode(), train.direction(), train.currentTrackId(),
                train.previousStationId(), train.nextStationId(), train.progress(), train.speedKmph(), train.status(),
                train.passengerCount(), train.capacity(), dwellRemainingSeconds, train.heldSeconds(),
                train.scheduledDepartureSeconds(), train.dwellTimeSeconds(), train.maxSpeedKmph(),
                train.accelerationMps2(), train.brakingRateMps2());
    }

    private TrainState withStatus(TrainState train, TrainStatus status, long previousStationId, long nextStationId,
                                   Long currentTrackId, double progress, double speedKmph, int heldSeconds) {
        return new TrainState(train.id(), train.code(), train.lineCode(), train.direction(), currentTrackId,
                previousStationId, nextStationId, progress, speedKmph, status, train.passengerCount(),
                train.capacity(), 0, heldSeconds, train.scheduledDepartureSeconds(), train.dwellTimeSeconds(),
                train.maxSpeedKmph(), train.accelerationMps2(), train.brakingRateMps2());
    }

    private SimulationEvent event(long tick, Instant simTime, EventType type, TrainState train, Long stationId,
                                   String message) {
        return new SimulationEvent(tick, simTime, type, train.id(), train.code(), stationId, message);
    }

    private record StepResult(TrainState train, List<SimulationEvent> events) {
        static StepResult unchanged(TrainState train) {
            return new StepResult(train, List.of());
        }

        static StepResult of(TrainState train, SimulationEvent event) {
            return new StepResult(train, List.of(event));
        }
    }
}
