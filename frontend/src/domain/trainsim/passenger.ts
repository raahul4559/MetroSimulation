export type PassengerStatus =
  | "WAITING"
  | "BOARDING"
  | "ON_TRAIN"
  | "ALIGHTING"
  | "TRANSFER"
  | "COMPLETED";

/** Mirrors the backend's `PassengerResponse` — one rider's live journey. Only active (not yet
 * `COMPLETED`) passengers are ever present in `SimulationState.passengers`; a completed journey's
 * stats are folded into `PassengerMetrics` instead. */
export interface Passenger {
  readonly id: number;
  readonly originStationId: number;
  readonly destinationStationId: number;
  readonly route: readonly number[];
  readonly currentStationId: number | null;
  readonly currentTrainId: number | null;
  readonly status: PassengerStatus;
  readonly arrivalTimeSeconds: number;
  readonly boardingTimeSeconds: number | null;
  readonly completionTimeSeconds: number | null;
}

/** Mirrors the backend's `PassengerMetricsResponse` — cumulative, run-lifetime totals. */
export interface PassengerMetrics {
  readonly totalGenerated: number;
  readonly totalServed: number;
  readonly totalUnableToBoard: number;
  readonly averageWaitSeconds: number;
  readonly averageTravelSeconds: number;
  readonly averageJourneySeconds: number;
}
