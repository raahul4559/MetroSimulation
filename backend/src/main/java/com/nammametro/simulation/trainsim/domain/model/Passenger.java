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
 * <p>{@code waitingSinceSeconds} is when this passenger's <em>current</em> platform wait began:
 * their spawn time while {@code WAITING} for a first train, re-stamped to the moment they alight
 * whenever they become a {@code TRANSFER}. It exists so "how long has this person been waiting for
 * a train that is not coming" can be answered without conflating it with time already spent riding
 * — see {@code PassengerBoardingHandler}'s abandonment rule, which is what keeps the active roster
 * bounded.
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
        long waitingSinceSeconds,
        Long boardingTimeSeconds,
        Long completionTimeSeconds
) {

    public boolean isAtFinalDestination() {
        return routeIndex >= route.size() - 1;
    }

    public Passenger withStatus(PassengerStatus newStatus) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                currentStationId, currentTrainId, newStatus, arrivalTimeSeconds, waitingSinceSeconds,
                boardingTimeSeconds, completionTimeSeconds);
    }

    /** Seconds this passenger has been stood on a platform waiting for their next train. Only
     * meaningful while {@code WAITING}/{@code TRANSFER} — see {@code waitingSinceSeconds}. */
    public long waitedSeconds(long nowSeconds) {
        return nowSeconds - waitingSinceSeconds;
    }

    /** Alighted mid-route and now waiting for a connection: the wait clock restarts here, so a
     * transferring rider is judged on how long <em>this</em> connection has taken, not on how long
     * they have been in the system overall. */
    public Passenger transferring(long nowSeconds) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                currentStationId, currentTrainId, PassengerStatus.TRANSFER, arrivalTimeSeconds,
                nowSeconds, boardingTimeSeconds, completionTimeSeconds);
    }

    /** Boards {@code trainId}, advancing {@code routeIndex} to {@code alightRouteIndex} (the next
     * point this specific leg lets them ride to without changing lines). */
    public Passenger boarding(long trainId, int alightRouteIndex, long nowSeconds) {
        return new Passenger(id, originStationId, destinationStationId, route, alightRouteIndex,
                null, trainId, PassengerStatus.BOARDING,
                arrivalTimeSeconds, waitingSinceSeconds,
                boardingTimeSeconds == null ? nowSeconds : boardingTimeSeconds,
                completionTimeSeconds);
    }

    public Passenger alighting(long stationId) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                stationId, null, PassengerStatus.ALIGHTING, arrivalTimeSeconds, waitingSinceSeconds,
                boardingTimeSeconds, completionTimeSeconds);
    }

    public Passenger completed(long nowSeconds) {
        return new Passenger(id, originStationId, destinationStationId, route, routeIndex,
                currentStationId, null, PassengerStatus.COMPLETED, arrivalTimeSeconds, waitingSinceSeconds,
                boardingTimeSeconds, nowSeconds);
    }
}
