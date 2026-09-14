package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.domain.model.TrainDirection;
import com.nammametro.simulation.metro.domain.model.Line;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickHandler;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerMetrics;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Alighting and boarding, "when a train arrives" exactly as specced: destination-reached passengers
 * leave first (freeing capacity), then waiting/transferring passengers attempt to board in arrival
 * order until the train is full, then whoever's left simply stays at the station for the next
 * suitable train. Runs after {@code PassengerDemandGenerationHandler} and before
 * {@code TrainMovementTickHandler} in the pipeline — so it always sees {@code TrainStatus#AT_STATION}
 * trains exactly as {@code TrainDispatcher}/last tick's {@code TrainMovementTickHandler} left them,
 * before that handler advances them into {@code DWELLING}.
 *
 * <p>{@link PassengerStatus#BOARDING}/{@link PassengerStatus#ALIGHTING} are one-tick transitional
 * states: this handler resolves whatever it marked <em>last</em> tick (to {@code ON_TRAIN}, or to
 * {@code COMPLETED}/{@code TRANSFER}) as its very first step, before marking any new transitions for
 * <em>this</em> tick — see {@link Passenger}'s javadoc for why {@code routeIndex} makes that resolve
 * a plain status flip rather than a re-derivation.
 *
 * <p>A boarding passenger's target train is decided purely by comparing station ids: the very next
 * station in their route must equal the train's next stop. {@code MetroNetwork} guarantees at most
 * one track between any adjacent station pair (see its {@code DUPLICATE_TRACK} validation), so two
 * different lines can never both offer that same next hop — no need to separately match line code
 * or direction.
 */
public class PassengerBoardingHandler implements TickHandler {

    @Override
    public TickResult handle(SimulationState current, TickContext ctx) {
        MetroNetwork network = ctx.network();
        long nowSeconds = current.clock().elapsedSimulationSeconds();

        Map<Long, Passenger> byId = new LinkedHashMap<>();
        PassengerMetrics metrics = resolveLastTicksTransitions(current, nowSeconds, byId);

        Map<Long, List<Passenger>> onboardByTrain = new HashMap<>();
        Map<Long, List<Passenger>> waitingByStation = new HashMap<>();
        for (Passenger p : byId.values()) {
            if (p.currentTrainId() != null) {
                onboardByTrain.computeIfAbsent(p.currentTrainId(), k -> new ArrayList<>()).add(p);
            } else if (p.currentStationId() != null
                    && (p.status() == PassengerStatus.WAITING || p.status() == PassengerStatus.TRANSFER)) {
                waitingByStation.computeIfAbsent(p.currentStationId(), k -> new ArrayList<>()).add(p);
            }
        }

        Map<Long, Integer> passengerCountDelta = new HashMap<>();
        long unableToBoard = 0;

        for (TrainState train : current.trains()) {
            if (train.status() != TrainStatus.AT_STATION) {
                continue;
            }
            long stationId = train.previousStationId();

            int alighted = 0;
            for (Passenger p : onboardByTrain.getOrDefault(train.id(), List.of())) {
                if (p.route().get(p.routeIndex()) == stationId) {
                    byId.put(p.id(), p.alighting(stationId));
                    alighted++;
                }
            }
            if (alighted > 0) {
                passengerCountDelta.merge(train.id(), -alighted, Integer::sum);
            }

            Long trainNextStop = nextStationAfter(train, network);
            if (trainNextStop == null) {
                continue; // terminating here — can't carry anyone further
            }

            int occupied = train.passengerCount() + passengerCountDelta.getOrDefault(train.id(), 0);
            int capacityLeft = train.capacity() - occupied;

            List<Passenger> candidates = new ArrayList<>(waitingByStation.getOrDefault(stationId, List.of()));
            candidates.sort(Comparator.comparingLong(Passenger::arrivalTimeSeconds).thenComparingLong(Passenger::id));

            for (Passenger snapshot : candidates) {
                Passenger p = byId.get(snapshot.id());
                if (p.status() != PassengerStatus.WAITING && p.status() != PassengerStatus.TRANSFER) {
                    continue; // already boarded a different (e.g. interchange) train earlier this tick
                }
                int nextIdx = p.routeIndex() + 1;
                if (nextIdx >= p.route().size() || !p.route().get(nextIdx).equals(trainNextStop)) {
                    continue; // this train doesn't serve this passenger's next hop
                }

                if (capacityLeft <= 0) {
                    unableToBoard++;
                    continue;
                }

                int alightIndex = legEndpointIndex(p.route(), p.routeIndex(), network);
                byId.put(p.id(), p.boarding(train.id(), alightIndex, nowSeconds));
                capacityLeft--;
                passengerCountDelta.merge(train.id(), 1, Integer::sum);
            }
        }

        if (unableToBoard > 0) {
            metrics = metrics.withUnableToBoard(unableToBoard);
        }

        List<TrainState> updatedTrains = current.trains().stream()
                .map(t -> {
                    Integer delta = passengerCountDelta.get(t.id());
                    return delta == null ? t : t.withPassengerCount(t.passengerCount() + delta);
                })
                .toList();

        SimulationState result = current.withTrains(updatedTrains)
                .withPassengers(List.copyOf(byId.values()))
                .withPassengerMetrics(metrics);
        return TickResult.noEvents(result);
    }

    /** Resolves every passenger left in a transitional state ({@code BOARDING}/{@code ALIGHTING})
     * by the previous tick, populating {@code byId} with every still-active passenger (completed
     * ones are folded into the returned metrics and dropped instead). */
    private PassengerMetrics resolveLastTicksTransitions(SimulationState current, long nowSeconds,
                                                           Map<Long, Passenger> byId) {
        PassengerMetrics metrics = current.passengerMetrics();
        for (Passenger p : current.passengers()) {
            switch (p.status()) {
                case ALIGHTING -> {
                    if (p.isAtFinalDestination()) {
                        long wait = p.boardingTimeSeconds() - p.arrivalTimeSeconds();
                        long travel = nowSeconds - p.boardingTimeSeconds();
                        long journey = nowSeconds - p.arrivalTimeSeconds();
                        metrics = metrics.withCompletedJourney(wait, travel, journey);
                    } else {
                        byId.put(p.id(), p.withStatus(PassengerStatus.TRANSFER));
                    }
                }
                case BOARDING -> byId.put(p.id(), p.withStatus(PassengerStatus.ON_TRAIN));
                default -> byId.put(p.id(), p);
            }
        }
        return metrics;
    }

    /** The farthest index in {@code route}, starting from {@code fromIndex}, reachable without
     * changing lines — i.e. where this leg's ride ends (a transfer point, or the final destination). */
    private int legEndpointIndex(List<Long> route, int fromIndex, MetroNetwork network) {
        if (fromIndex >= route.size() - 1) {
            return fromIndex;
        }
        String lineCode = trackBetween(route, fromIndex, network).lineCode();
        int idx = fromIndex + 1;
        while (idx + 1 < route.size() && trackBetween(route, idx, network).lineCode().equals(lineCode)) {
            idx++;
        }
        return idx;
    }

    private Track trackBetween(List<Long> route, int fromIndex, MetroNetwork network) {
        return network.getSingleTrackBetween(route.get(fromIndex), route.get(fromIndex + 1)).orElseThrow();
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
}
