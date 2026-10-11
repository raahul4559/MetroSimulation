import type { DataSource } from "../realtime";

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

/**
 * Mirrors the backend's `MetroTrainResponse` — one train in the canonical realtime state, from
 * whichever source is active. Every view (2D map, 3D station, boards, announcements) reads this.
 *
 * Fields a source cannot know are `null`, never a plausible-looking zero: a GTFS feed reports no
 * passenger counts and a timetable knows no delays. "0 passengers" or "on time" would be invented.
 * The position fields follow the simulation's conventions for every source: at a platform,
 * `previousStationId === nextStationId` and `currentTrackId` is null.
 */
export interface TrainState {
  readonly id: number;
  readonly code: string;
  readonly lineCode: string;
  readonly direction: TrainDirection;
  readonly currentTrackId: number | null;
  readonly previousStationId: number;
  readonly nextStationId: number;
  readonly progress: number;
  readonly speedKmph: number | null;
  readonly status: TrainStatus;
  readonly passengerCount: number | null;
  readonly capacity: number | null;
  /** Seconds behind schedule; null when the source doesn't say (which is not "on time"). */
  readonly delaySeconds: number | null;
  /** Provider-predicted arrival at `nextStationId` (ISO instant), when a feed gives one. */
  readonly nextStationEta: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  /** Simulation-only bookkeeping (simulation-elapsed seconds); null for every other source. */
  readonly scheduledDepartureSeconds: number | null;
  readonly dwellTimeSeconds: number | null;
  readonly maxSpeedKmph: number | null;
  readonly accelerationMps2: number | null;
  readonly brakingRateMps2: number | null;
  readonly scheduledArrivalSeconds: number | null;
  readonly actualArrivalSeconds: number | null;
  readonly actualDepartureSeconds: number | null;
  /** Provenance — where this position came from. Labels derive from this, never from the socket. */
  readonly source: DataSource;
  readonly vehicleId: string | null;
  readonly tripId: string | null;
  /** When the source last placed this train (provider measurement time, ISO instant). */
  readonly observedAt: string | null;
  /** The observation is older than the server's staleness threshold. */
  readonly stale: boolean;
  /** The position was extrapolated or inferred rather than reported as-is. */
  readonly positionEstimated: boolean;
}

/** Mirrors the simulation engine's own `TrainStateResponse` (`/api/simulation/*`). The UI renders
 * {@link TrainState} from the canonical feed instead; this is only the control endpoints' reply. */
export interface SimulationTrainState {
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
  readonly delaySeconds: number;
  readonly source: "SIMULATION";
}
