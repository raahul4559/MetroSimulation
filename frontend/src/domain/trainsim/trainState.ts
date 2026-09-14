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
  /** Seconds this train has been held past when it wanted to depart — 0 when running on time. */
  readonly delaySeconds: number;
}
