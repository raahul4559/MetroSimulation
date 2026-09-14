package com.nammametro.simulation.trainsim.domain.model;

import java.util.List;

/**
 * A rider's journey, origin to destination — replaced wholesale each tick like {@link TrainState},
 * never mutated in place. {@code route} is the full station-id path (origin first, destination
 * last) from {@code DijkstraRouteFinder}, computed once at spawn and never recomputed — a passenger
 * doesn't re-route mid-journey.
 *
 * <p>{@code routeIndex} is implementation state (not part of the spec's literal field list, same
 * status as {@code TrainState}'s {@code dwellRemainingSeconds}/{@code heldSeconds}): the index into
 * {@code route} of this passenger's <em>next boarding-relevant waypoint</em>. While waiting/
 * transferring it's simply where they are now ({@code route.get(routeIndex) == currentStationId}).
 * Once they board, {@code PassengerBoardingHandler} advances it past every station reachable
 * without changing lines — the station where they must next get off (to transfer, or because
 * they've arrived) — so alighting is a single index comparison, not a re-walk of the route every
 * tick.
 *
 * <p>Exactly one of {@code currentStationId}/{@code currentTrainId} is non-null at a time: at a
 * station (WAITING/BOARDING/ALIGHTING/TRANSFER/COMPLETED) it's the station; ON_TRAIN it's the train.
 * {@code arrivalTimeSeconds}/{@code boardingTimeSeconds}/{@code completionTimeSeconds} are all
 * simulation-elapsed seconds ({@code SimulationClock#elapsedSimulationSeconds}), not tick counts —
 * ticks represent varying amounts of simulated time depending on {@code SimulationSpeed}, so seconds
 * are the only basis duration metrics can be computed from correctly across a speed change.
 */
public record Passenger(
        long id,
        long originStationId,
        long destinationStationId,
        List<Long> route,
        int routeIndex,
        Long currentStationId,
        Long currentTrainId,
        PassengerStatus status,
        long arrivalTimeSeconds,
        Long boardingTimeSeconds,
        Long completionTimeSeconds
) {

    public boolean isAtFinalDestination() {
        return routeIndex >= route.size() - 1;
    }

    public Passenger withStatus(PassengerStatus newStatus) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                currentStationId, currentTrainId, newStatus, arrivalTimeSeconds, boardingTimeSeconds,
                completionTimeSeconds);
    }

    /** Boards {@code trainId}, advancing {@code routeIndex} to {@code alightRouteIndex} (the next
     * point this specific leg lets them ride to without changing lines). */
    public Passenger boarding(long trainId, int alightRouteIndex, long nowSeconds) {
        return new Passenger(id, originStationId, destinationStationId, route, alightRouteIndex,
                null, trainId, PassengerStatus.BOARDING,
                arrivalTimeSeconds, boardingTimeSeconds == null ? nowSeconds : boardingTimeSeconds,
                completionTimeSeconds);
    }

    public Passenger alighting(long stationId) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                stationId, null, PassengerStatus.ALIGHTING, arrivalTimeSeconds, boardingTimeSeconds,
                completionTimeSeconds);
    }

    public Passenger completed(long nowSeconds) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                currentStationId, null, PassengerStatus.COMPLETED, arrivalTimeSeconds, boardingTimeSeconds,
                nowSeconds);
    }
}
