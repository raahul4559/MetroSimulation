package com.nammametro.simulation.trainsim.domain.model;

/**
 * Every value here is reachable and meaningful in the tick state machine (see
 * {@code TrainDispatcher} for the first transition, {@code TrainMovementTickHandler} for the
 * rest) — none are placeholders:
 *
 * <pre>
 * SCHEDULED --(elapsed >= scheduledDepartureSeconds)--> AT_STATION --------> DWELLING --(no next station)--> COMPLETED
 *                                                                               |
 *                                                                      (has next station)
 *                                                                               |
 *                                                                       track occupied? --yes--> STOPPED --(still blocked, past threshold)--> DELAYED
 *                                                                               |no                  |                                          |
 *                                                                               v                    +------------------(track clears)----------+
 *                                                                          DEPARTING <---------------------------------------------------------- +
 *                                                                               |
 *                                                                               v
 *                                                                           RUNNING --(progress >= 1)--> ARRIVING --> AT_STATION
 * </pre>
 */
public enum TrainStatus {
    SCHEDULED,
    AT_STATION,
    DWELLING,
    DEPARTING,
    RUNNING,
    ARRIVING,
    STOPPED,
    DELAYED,
    COMPLETED
}
