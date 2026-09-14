package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickHandler;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.AffectedResourceType;
import com.nammametro.simulation.trainsim.domain.model.BlockState;
import com.nammametro.simulation.trainsim.domain.model.Disruption;
import com.nammametro.simulation.trainsim.domain.model.DisruptionStatus;
import com.nammametro.simulation.trainsim.domain.model.DisruptionType;
import com.nammametro.simulation.trainsim.domain.model.EventType;
import com.nammametro.simulation.trainsim.domain.model.Signal;
import com.nammametro.simulation.trainsim.domain.model.SimulationEvent;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Advances every train by one tick: dwell countdown, signal-gated departure, continuous progress
 * along the current block under real accel/cruise/brake kinematics (with a caution-speed
 * restriction when the block beyond is not clear), and arrival handling. Also produces this tick's
 * {@link Signal} for every track — the map's "block section" and headway logic are the same data,
 * not two parallel implementations that could drift apart.
 *
 * <p>Occupancy is read from a {@link BlockBoard} snapshotted from {@code current} before any train
 * in this tick is updated, then mutated as trains are processed (in fixed roster order) — so two
 * trains whose dwell expires in the SAME tick can't both claim the same block (the second sees the
 * first's claim), independent of iteration order as an input, deterministically so as an output.
 * {@link TrainStatus#SCHEDULED} trains are untouched here — releasing them into service is
 * {@code TrainDispatcher}'s job, earlier in the pipeline.
 */
public class TrainMovementTickHandler implements TickHandler {

    /** A train departing under a YELLOW-observed (RESERVED) downstream block cruises at this
     * fraction of its normal max speed — the simulation's whole "speed restriction" story: simple,
     * visible, and not a claim to model real multi-aspect distant signalling. */
    private static final double CAUTION_SPEED_FACTOR = 0.5;

    @Override
    public TickResult handle(SimulationState current, TickContext context) {
        long delta = context.settings().deltaSecondsFor(current.clock().speed());
        long tick = current.clock().currentTick();
        Instant simTime = current.clock().currentTime();
        long nowSeconds = current.clock().elapsedSimulationSeconds();
        List<Disruption> disruptions = current.disruptions();

        BlockBoard board = initialBoard(current.trains());
        for (long blockedTrackId : blockedTrackIds(disruptions)) {
            board.blockIfFree(blockedTrackId);
        }

        List<TrainState> updated = new ArrayList<>();
        List<SimulationEvent> events = new ArrayList<>();

        for (TrainState train : current.trains()) {
            StepResult step = advance(train, delta, context, tick, simTime, nowSeconds, disruptions, board);
            if (step.train().status() == TrainStatus.DEPARTING) {
                board.reserve(step.train().currentTrackId(), step.train().id());
            }
            updated.add(step.train());
            events.addAll(step.events());
        }

        List<TrainState> withLiveDelay = updated.stream().map(t -> recomputeDelay(t, nowSeconds)).toList();

        List<Signal> signals = context.network().allTracks().stream()
                .map(track -> board.toSignal(track.id()))
                .toList();

        return new TickResult(current.withTrains(withLiveDelay).withSignals(signals), events);
    }

    private BlockBoard initialBoard(List<TrainState> trains) {
        BlockBoard board = new BlockBoard();
        for (TrainState t : trains) {
            boolean inBlock = t.status() == TrainStatus.DEPARTING || t.status() == TrainStatus.RUNNING
                    || t.status() == TrainStatus.ARRIVING;
            if (inBlock && t.currentTrackId() != null) {
                board.occupy(t.currentTrackId(), t.id());
            }
        }
        return board;
    }

    private StepResult advance(TrainState train, long delta, TickContext ctx, long tick, Instant simTime,
                                long nowSeconds, List<Disruption> disruptions, BlockBoard board) {
        MetroNetwork network = ctx.network();

        if (train.status() != TrainStatus.SCHEDULED && train.status() != TrainStatus.COMPLETED
                && isTrainForciblyHeld(disruptions, train.id())) {
            return StepResult.unchanged(train.withSpeed(0));
        }

        return switch (train.status()) {
            case SCHEDULED, COMPLETED -> StepResult.unchanged(train);

            case AT_STATION -> {
                Station station = network.findStation(train.previousStationId()).orElseThrow();
                int extraDwell = extraDwellSecondsFor(disruptions, station.id(), train.id());
                yield StepResult.of(
                        withDwellStatus(train, train.dwellTimeSeconds() + extraDwell),
                        event(tick, simTime, EventType.DWELL_STARTED, train, station.id(),
                                "%s began dwelling at %s".formatted(train.code(), station.name())));
            }

            case DWELLING -> {
                int remaining = train.dwellRemainingSeconds() - (int) delta;
                if (remaining > 0) {
                    yield StepResult.unchanged(withDwellRemaining(train, remaining));
                }
                yield handleDwellExpiry(train, ctx, tick, simTime, nowSeconds, board);
            }

            case STOPPED, DELAYED -> tryDepart(train, ctx, tick, simTime, nowSeconds, board, (int) delta);

            case DEPARTING -> {
                Track track = network.getSingleTrackBetween(train.previousStationId(), train.nextStationId())
                        .orElseThrow();
                yield StepResult.of(advanceAlongTrack(train, track, delta, ctx, disruptions, board),
                        event(tick, simTime, EventType.DEPARTED, train, train.previousStationId(),
                                "%s departed toward %s".formatted(train.code(), stationName(network, train.nextStationId()))));
            }

            case RUNNING -> {
                Track track = network.getSingleTrackBetween(train.previousStationId(), train.nextStationId())
                        .orElseThrow();
                yield StepResult.unchanged(advanceAlongTrack(train, track, delta, ctx, disruptions, board));
            }

            case ARRIVING -> {
                Station arrivedAt = network.findStation(train.nextStationId()).orElseThrow();
                yield StepResult.of(
                        atStation(train, arrivedAt.id(), nowSeconds),
                        event(tick, simTime, EventType.ARRIVED, train, arrivedAt.id(),
                                "%s arrived at %s".formatted(train.code(), arrivedAt.name())));
            }
        };
    }

    /**
     * One tick of real kinematics along the train's current block: accelerate toward its
     * effective max speed unless the remaining distance is inside the braking distance needed to
     * stop at the platform ({@code v^2 / (2 * brakingRateMps2)}), in which case decelerate instead
     * — the standard "always look ahead to the stop point" trapezoidal-profile controller. The
     * effective max speed is the train's own {@code maxSpeedKmph}, capped by
     * {@link #CAUTION_SPEED_FACTOR} if the block beyond this one isn't FREE — a simplified stand-in
     * for a following train restraining its speed rather than rushing up to a busy platform.
     * Distance covered this tick is the trapezoidal average of the speed at the start and end of
     * the tick. Never overshoots the platform: progress clamps at 1.0 and the train becomes
     * {@link TrainStatus#ARRIVING} instead.
     *
     * <p>If this block itself is disruption-blocked (a {@code TRACK_BLOCKAGE}/{@code SIGNAL_FAILURE}
     * started while the train was already on it), the train simply stops where it is — no
     * kinematics, no progress change — until the disruption resolves.
     */
    private TrainState advanceAlongTrack(TrainState train, Track track, long delta, TickContext ctx,
                                          List<Disruption> disruptions, BlockBoard board) {
        if (isTrackBlocked(disruptions, track.id())) {
            return train.withSpeed(0);
        }

        double trackLengthMetres = track.distanceMetres();
        double distanceIntoTrack = train.progress() * trackLengthMetres;
        double remaining = trackLengthMetres - distanceIntoTrack;

        double v0 = train.speedKmph() / 3.6;
        double maxSpeed = effectiveMaxSpeedMps(train, ctx, board);
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

    private double effectiveMaxSpeedMps(TrainState train, TickContext ctx, BlockBoard board) {
        double maxSpeed = train.maxSpeedKmph() / 3.6;
        Long downstreamTrackId = downstreamTrackId(train, ctx.network());
        if (downstreamTrackId == null || board.stateOf(downstreamTrackId) == BlockState.FREE) {
            return maxSpeed;
        }
        return maxSpeed * CAUTION_SPEED_FACTOR;
    }

    /** The block a train will need *after* the one it's currently on — i.e. the one leaving the
     * station it's currently headed toward. {@code null} if that station is the end of the route. */
    private Long downstreamTrackId(TrainState train, MetroNetwork network) {
        Line line = network.findLineByCode(train.lineCode()).orElseThrow();
        List<Station> route = routeStations(line, train.direction());
        int nextIndex = indexOf(route, train.nextStationId());
        if (nextIndex + 1 >= route.size()) {
            return null;
        }
        long afterNextStationId = route.get(nextIndex + 1).id();
        return network.getSingleTrackBetween(train.nextStationId(), afterNextStationId).map(Track::id).orElse(null);
    }

    private StepResult handleDwellExpiry(TrainState train, TickContext ctx, long tick, Instant simTime,
                                          long nowSeconds, BlockBoard board) {
        Long nextId = nextStationAfter(train, ctx.network());
        if (nextId == null) {
            TrainState completed = withStatus(train, TrainStatus.COMPLETED, train.previousStationId(),
                    train.previousStationId(), null, 0, 0, 0);
            return StepResult.of(completed, event(tick, simTime, EventType.ROUTE_COMPLETED, train,
                    train.previousStationId(), "%s completed its route".formatted(train.code())));
        }

        TrainState pendingDeparture = withStatus(train, TrainStatus.DWELLING, train.previousStationId(), nextId,
                null, 0, 0, 0);
        return tryDepart(pendingDeparture, ctx, tick, simTime, nowSeconds, board, 0);
    }

    /** On successful departure, records the actual departure time and projects the next nominal
     * scheduled arrival (this leg's departure + its {@code Track#expectedTravelTimeSeconds}) — see
     * the class javadoc's "delay tracking" note. */
    private StepResult tryDepart(TrainState train, TickContext ctx, long tick, Instant simTime, long nowSeconds,
                                  BlockBoard board, int extraHeldSeconds) {
        Track track = ctx.network().getSingleTrackBetween(train.previousStationId(), train.nextStationId())
                .orElseThrow();

        if (board.isFree(track.id())) {
            TrainState departing = withStatus(train, TrainStatus.DEPARTING, train.previousStationId(),
                    train.nextStationId(), track.id(), 0, 0, 0);
            int nominalArrival = (int) (train.scheduledDepartureSeconds() + track.expectedTravelTimeSeconds());
            departing = departing.withScheduleUpdate(train.scheduledDepartureSeconds(), nominalArrival,
                    train.actualArrivalSeconds(), (int) nowSeconds, train.delaySeconds());
            return StepResult.unchanged(departing);
        }

        int heldSeconds = train.heldSeconds() + extraHeldSeconds;
        boolean delayed = heldSeconds >= ctx.settings().delayThresholdSeconds();
        TrainStatus status = delayed ? TrainStatus.DELAYED : TrainStatus.STOPPED;
        TrainState held = withStatus(train, status, train.previousStationId(), train.nextStationId(), null, 0, 0,
                heldSeconds);

        EventType type = delayed ? EventType.DELAYED : EventType.HELD_FOR_HEADWAY;
        String message = "%s held at %s for headway (%ds) — signal at RED"
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

    /** Records the arrival and projects the next nominal scheduled departure (arrival + this
     * train's own, undisrupted dwell time) — see the class javadoc's "delay tracking" note. */
    private TrainState atStation(TrainState train, long arrivedStationId, long nowSeconds) {
        TrainState base = withStatus(train, TrainStatus.AT_STATION, arrivedStationId, arrivedStationId, null, 0, 0, 0);
        Integer scheduledArrival = train.scheduledArrivalSeconds();
        long referenceArrival = scheduledArrival != null ? scheduledArrival : nowSeconds;
        long nominalNextDeparture = referenceArrival + train.dwellTimeSeconds();
        return base.withScheduleUpdate(nominalNextDeparture, train.scheduledArrivalSeconds(), (int) nowSeconds,
                train.actualDepartureSeconds(), train.delaySeconds());
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
                train.accelerationMps2(), train.brakingRateMps2(), train.scheduledArrivalSeconds(),
                train.actualArrivalSeconds(), train.actualDepartureSeconds(), train.delaySeconds());
    }

    private TrainState withStatus(TrainState train, TrainStatus status, long previousStationId, long nextStationId,
                                   Long currentTrackId, double progress, double speedKmph, int heldSeconds) {
        return new TrainState(train.id(), train.code(), train.lineCode(), train.direction(), currentTrackId,
                previousStationId, nextStationId, progress, speedKmph, status, train.passengerCount(),
                train.capacity(), 0, heldSeconds, train.scheduledDepartureSeconds(), train.dwellTimeSeconds(),
                train.maxSpeedKmph(), train.accelerationMps2(), train.brakingRateMps2(), train.scheduledArrivalSeconds(),
                train.actualArrivalSeconds(), train.actualDepartureSeconds(), train.delaySeconds());
    }

    /** Recomputed for every non-terminal train at the end of every tick (not just at
     * arrival/departure) so a train sitting held or over-dwelling shows growing delay live:
     * {@code max(0, nowSeconds - referenceSeconds)}, where the reference is the scheduled arrival
     * while en route or the scheduled departure otherwise. */
    private TrainState recomputeDelay(TrainState train, long nowSeconds) {
        if (train.status() == TrainStatus.SCHEDULED || train.status() == TrainStatus.COMPLETED) {
            return train;
        }
        boolean enRoute = train.status() == TrainStatus.DEPARTING || train.status() == TrainStatus.RUNNING
                || train.status() == TrainStatus.ARRIVING;
        Integer reference = enRoute ? train.scheduledArrivalSeconds() : Integer.valueOf((int) train.scheduledDepartureSeconds());
        if (reference == null) {
            return train;
        }
        int live = (int) Math.max(0, nowSeconds - reference);
        if (live == train.delaySeconds()) {
            return train;
        }
        return train.withScheduleUpdate(train.scheduledDepartureSeconds(), train.scheduledArrivalSeconds(),
                train.actualArrivalSeconds(), train.actualDepartureSeconds(), live);
    }

    private boolean isTrackBlocked(List<Disruption> disruptions, long trackId) {
        for (Disruption d : disruptions) {
            if (d.status() == DisruptionStatus.ACTIVE && d.resourceType() == AffectedResourceType.TRACK
                    && d.resourceId() == trackId
                    && (d.type() == DisruptionType.TRACK_BLOCKAGE || d.type() == DisruptionType.SIGNAL_FAILURE)) {
                return true;
            }
        }
        return false;
    }

    private Set<Long> blockedTrackIds(List<Disruption> disruptions) {
        Set<Long> ids = new HashSet<>();
        for (Disruption d : disruptions) {
            if (d.status() == DisruptionStatus.ACTIVE && d.resourceType() == AffectedResourceType.TRACK
                    && (d.type() == DisruptionType.TRACK_BLOCKAGE || d.type() == DisruptionType.SIGNAL_FAILURE)) {
                ids.add(d.resourceId());
            }
        }
        return ids;
    }

    private boolean isTrainForciblyHeld(List<Disruption> disruptions, long trainId) {
        for (Disruption d : disruptions) {
            if (d.status() == DisruptionStatus.ACTIVE && d.resourceType() == AffectedResourceType.TRAIN
                    && d.resourceId() == trainId
                    && (d.type() == DisruptionType.TRAIN_FAILURE || d.type() == DisruptionType.CUSTOM_DELAY)) {
                return true;
            }
        }
        return false;
    }

    private int extraDwellSecondsFor(List<Disruption> disruptions, long stationId, long trainId) {
        int extra = 0;
        for (Disruption d : disruptions) {
            if (d.status() != DisruptionStatus.ACTIVE) {
                continue;
            }
            if (d.type() == DisruptionType.STATION_CONGESTION && d.resourceType() == AffectedResourceType.STATION
                    && d.resourceId() == stationId) {
                extra += d.magnitudeSeconds();
            } else if (d.type() == DisruptionType.EXTENDED_DWELL && d.resourceType() == AffectedResourceType.TRAIN
                    && d.resourceId() == trainId) {
                extra += d.magnitudeSeconds();
            }
        }
        return extra;
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

    /** This tick's block occupancy, mutated as trains are processed (see class javadoc). Not a
     * domain type itself — {@link #toSignal} is what turns one of its entries into the {@link Signal}
     * the rest of the system actually sees. */
    private static final class BlockBoard {
        private final Map<Long, BlockState> states = new HashMap<>();
        private final Map<Long, Long> controllers = new HashMap<>();

        boolean isFree(long trackId) {
            return stateOf(trackId) == BlockState.FREE;
        }

        BlockState stateOf(long trackId) {
            return states.getOrDefault(trackId, BlockState.FREE);
        }

        void occupy(long trackId, long trainId) {
            states.put(trackId, BlockState.OCCUPIED);
            controllers.put(trackId, trainId);
        }

        void reserve(long trackId, long trainId) {
            states.put(trackId, BlockState.RESERVED);
            controllers.put(trackId, trainId);
        }

        /** A train id can never be assigned this value (see {@code LineScheduleAssembler}, which
         * always multiplies a positive schedule id) — used as the signal's controller for a track
         * blocked by a disruption with no real train on it. */
        private static final long NO_TRAIN_SENTINEL = -1L;

        /** Forces a track OCCUPIED for a disruption, but only if no real train already claimed it
         * this tick — preserves the real train's id as the signal's controller when one's present. */
        void blockIfFree(long trackId) {
            if (stateOf(trackId) == BlockState.FREE) {
                states.put(trackId, BlockState.OCCUPIED);
                controllers.put(trackId, NO_TRAIN_SENTINEL);
            }
        }

        Signal toSignal(long trackId) {
            Long controller = controllers.get(trackId);
            return switch (stateOf(trackId)) {
                case FREE -> Signal.free(trackId);
                case RESERVED -> Signal.reserved(trackId, controller);
                case OCCUPIED -> Signal.occupied(trackId, controller);
            };
        }
    }
}
