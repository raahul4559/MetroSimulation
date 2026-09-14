package com.nammametro.simulation.trainsim.domain.model;

/**
 * Cumulative, run-lifetime passenger metrics — kept separate from the live {@code Passenger} roster
 * in {@link SimulationState} so a completed passenger's stats can be folded in here and the
 * passenger record itself dropped, rather than the roster growing without bound for the life of a
 * long-running simulation. Averages are derived, not stored, so they're always consistent with the
 * running totals they're computed from.
 *
 * <p>For a completed passenger: {@code waitSeconds} is {@code boardingTime - arrivalTime} (time
 * spent waiting for their <em>first</em> train — not summed across transfer waits too, a
 * deliberate simplification); {@code travelSeconds} is {@code completionTime - boardingTime} (time
 * from first boarding to arrival, "time spent on the journey" including any transfers);
 * {@code journeySeconds} is {@code completionTime - arrivalTime}, the sum of the two — total door-
 * to-door time, the metric a rider actually experiences.
 */
public record PassengerMetrics(
        long totalGenerated,
        long totalServed,
        long totalUnableToBoard,
        long totalWaitSeconds,
        long totalTravelSeconds,
        long totalJourneySeconds
) {

    public static PassengerMetrics empty() {
        return new PassengerMetrics(0, 0, 0, 0, 0, 0);
    }

    public PassengerMetrics withGenerated(long additionalGenerated) {
        return new PassengerMetrics(totalGenerated + additionalGenerated, totalServed, totalUnableToBoard,
                totalWaitSeconds, totalTravelSeconds, totalJourneySeconds);
    }

    public PassengerMetrics withUnableToBoard(long additionalDenied) {
        return new PassengerMetrics(totalGenerated, totalServed, totalUnableToBoard + additionalDenied,
                totalWaitSeconds, totalTravelSeconds, totalJourneySeconds);
    }

    /** Folds one just-completed passenger's journey into the running totals. */
    public PassengerMetrics withCompletedJourney(long waitSeconds, long travelSeconds, long journeySeconds) {
        return new PassengerMetrics(totalGenerated, totalServed + 1, totalUnableToBoard,
                totalWaitSeconds + waitSeconds, totalTravelSeconds + travelSeconds,
                totalJourneySeconds + journeySeconds);
    }

    public double averageWaitSeconds() {
        return totalServed == 0 ? 0.0 : (double) totalWaitSeconds / totalServed;
    }

    public double averageTravelSeconds() {
        return totalServed == 0 ? 0.0 : (double) totalTravelSeconds / totalServed;
    }

    public double averageJourneySeconds() {
        return totalServed == 0 ? 0.0 : (double) totalJourneySeconds / totalServed;
    }
}
