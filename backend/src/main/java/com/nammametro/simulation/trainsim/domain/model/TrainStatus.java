package com.nammametro.simulation.trainsim.domain.model;

/**
 * Every value here is reachable and meaningful in the tick state machine (see
 * {@code TrainMovementTickHandler}) — none are placeholders:
 *
 * <pre>
 * AT_STATION --------> DWELLING --(no next station)--> COMPLETED
 *                          |
 *                (has next station)
 *                          |
 *                  track occupied? --yes--> STOPPED --(still blocked, past threshold)--> DELAYED
 *                          |no                  |                                          |
 *                          v                    +------------------(track clears)----------+
 *                     DEPARTING <---------------------------------------------------------- +
 *                          |
 *                          v
 *                      RUNNING --(progress >= 1)--> ARRIVING --> AT_STATION
 * </pre>
 */
public enum TrainStatus {
    AT_STATION,
    DWELLING,
    DEPARTING,
    RUNNING,
    ARRIVING,
    STOPPED,
    DELAYED,
    COMPLETED
}
