export type TrainDirection = "OUTBOUND" | "INBOUND";

export type TrainStatus =
  | "SCHEDULED"
  | "AT_STATION"
  | "DWELLING"
  | "DEPARTING"
  | "RUNNING"
  | "ARRIVING"
  | "STOPPED"
  | "DELAYED"
  | "COMPLETED";

/** Mirrors the backend's `TrainStateResponse` — one train's live position/status. */
export interface TrainState {
  readonly id: number;
  readonly code: string;
  readonly lineCode: string;
  readonly direction: TrainDirection;
  readonly currentTrackId: number | null;
  readonly previousStationId: number;
  readonly nextStationId: number;
  readonly progress: number;
  readonly speedKmph: number;
  readonly status: TrainStatus;
  readonly passengerCount: number;
  readonly capacity: number;
  readonly scheduledDepartureSeconds: number;
  readonly dwellTimeSeconds: number;
  readonly maxSpeedKmph: number;
  readonly accelerationMps2: number;
  readonly brakingRateMps2: number;
  /** Seconds behind the nominal schedule right now — 0 when on time, recomputed live every tick. */
  readonly delaySeconds: number;
  /** Nominal-vs-actual timestamps (simulation-elapsed seconds) for this train's most recent leg —
   * null until the corresponding event has happened at least once. */
  readonly scheduledArrivalSeconds: number | null;
  readonly actualArrivalSeconds: number | null;
  readonly actualDepartureSeconds: number | null;
}
