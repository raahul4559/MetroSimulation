import type { TrainState } from "./trainsim/trainState";
import type { SimulationClock } from "./trainsim/simulationClock";
import type { Signal } from "./trainsim/signal";
import type { Passenger, PassengerMetrics } from "./trainsim/passenger";
import type { Disruption } from "./trainsim/disruption";

/**
 * Where a train's position came from. Mirrors the backend's `DataSource`.
 *
 * Only `LIVE` (an authorized operator feed) and `GTFS_REALTIME` are observations. `SCHEDULE` is a
 * timetable estimate and `SIMULATION` is invented by construction — neither may ever be shown as
 * live, however healthy the connection is.
 */
export type DataSource = "LIVE" | "GTFS_REALTIME" | "SCHEDULE" | "SIMULATION";

export type RealtimeMode = "AUTO" | DataSource;

export type ProviderStatus = "UNCONFIGURED" | "CONNECTING" | "HEALTHY" | "STALE" | "ERROR";

export interface ProviderHealth {
  readonly source: DataSource;
  readonly name: string;
  readonly status: ProviderStatus;
  readonly detail: string | null;
  readonly lastAttemptAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly feedTimestamp: string | null;
  readonly nextAttemptAt: string | null;
  readonly consecutiveFailures: number;
  readonly acceptedVehicles: number;
  readonly rejectedVehicles: number;
  readonly rejectionReasons: Readonly<Record<string, number>>;
  readonly warnings: readonly string[];
}

export type LineOperatingState = "OPERATING" | "NOT_OPERATING" | "SUSPENDED" | "UNKNOWN";

/** Whether a line should be running now, and on what basis (`TIMETABLE` or `ALERT`). `UNKNOWN`
 * with no timetable configured is a correct answer, not an error. */
export interface LineStatus {
  readonly lineCode: string;
  readonly state: LineOperatingState;
  readonly basis: string;
  readonly reason: string | null;
  readonly firstDeparture: string | null;
  readonly lastDeparture: string | null;
  readonly trainsReported: number;
}

export interface RealtimeAlert {
  readonly id: string;
  readonly source: DataSource;
  readonly cause: string | null;
  readonly effect: string | null;
  readonly severity: "UNKNOWN" | "INFO" | "WARNING" | "SEVERE";
  readonly headerText: string | null;
  readonly descriptionText: string | null;
  readonly activeFrom: string | null;
  readonly activeUntil: string | null;
  readonly lineCodes: readonly string[];
  readonly stationIds: readonly number[];
}

/** The simulation-only parts of the state; present only while the simulation is the source. */
export interface SimulationExtras {
  readonly clock: SimulationClock;
  readonly signals: readonly Signal[];
  readonly passengers: readonly Passenger[];
  readonly passengerMetrics: PassengerMetrics;
  readonly disruptions: readonly Disruption[];
}

/**
 * Mirrors the backend's `MetroStateResponse` — `GET /api/realtime/state` and every frame on
 * `/topic/realtime/state`. The one object every view renders from.
 *
 * `serverTime`/`serverEpochMillis` are authoritative; `isLive` is computed by the server (observed
 * source AND fresh) and is the only thing that may put the word "live" on screen.
 * `(instanceId, version)` orders frames: a lower version from the same instance is discarded, a new
 * instance id means the backend restarted.
 */
export interface MetroStateFrame {
  readonly instanceId: string;
  readonly version: number;
  readonly serverTime: string;
  readonly serverTimeIst: string;
  readonly serverEpochMillis: number;
  readonly timezone: string;
  readonly serviceDay: string;
  readonly dayType: string;
  readonly requestedMode: RealtimeMode;
  readonly activeSource: DataSource;
  readonly isLive: boolean;
  readonly activeSourceStale: boolean;
  readonly sourceReason: string;
  readonly providers: readonly ProviderHealth[];
  readonly lines: readonly LineStatus[];
  readonly trains: readonly TrainState[];
  readonly alerts: readonly RealtimeAlert[];
  readonly simulation: SimulationExtras | null;
}

export interface ServerTime {
  readonly serverTime: string;
  readonly serverTimeIst: string;
  readonly serverEpochMillis: number;
  readonly timezone: string;
}
