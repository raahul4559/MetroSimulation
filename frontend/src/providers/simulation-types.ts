import type { Interchange, Line, Station, Track } from "@/domain/metro";
import type {
  CreateDisruptionRequest,
  Disruption,
  Passenger,
  PassengerMetrics,
  Signal,
  SimulationClock,
  TrainState,
} from "@/domain/trainsim";
import type { LineStatus, MetroStateFrame, ProviderHealth, RealtimeAlert } from "@/domain/realtime";
import type { ConnectionStatus } from "@/lib/ws/realtime-socket";
import type { FeedProvenance } from "@/lib/realtime/provenance";

/**
 * The shapes published by {@link SimulationProvider}, split by how often each one changes.
 *
 * The split is the point: `SimulationDataValue` is replaced on every realtime frame, while the
 * network topology and the action callbacks are effectively static. Keeping them in separate
 * contexts means a component that only reads station geometry does not re-render sixty times a
 * minute because a train moved.
 */

/**
 * The canonical metro state, one frame at a time. Read this only where per-tick data is genuinely
 * needed. Everything here comes from the same `MetroStateFrame`, whichever source is active.
 */
export interface SimulationDataValue {
  /** The raw canonical frame, or null before the first one arrives. */
  readonly state: MetroStateFrame | null;
  readonly connectionStatus: ConnectionStatus;
  /** What is on screen and how much to trust it. The only basis for any "live" wording. */
  readonly feed: FeedProvenance;
  /** True while the simulation is the active source — its controls and extras only apply then. */
  readonly isSimulationSource: boolean;
  /** The simulation clock; a stopped placeholder while another source is active. */
  readonly clock: SimulationClock;
  /** HH:MM:SS of the trains on screen: the simulated time of day, or server time in IST. */
  readonly timeOfDay: string;
  /** Trains are in service: a running simulation, or any line operating / any train reported. */
  readonly serviceRunning: boolean;
  readonly trains: readonly TrainState[];
  readonly lineStatuses: readonly LineStatus[];
  readonly alerts: readonly RealtimeAlert[];
  readonly providers: readonly ProviderHealth[];
  readonly signals: readonly Signal[];
  readonly passengers: readonly Passenger[];
  readonly disruptions: readonly Disruption[];
  readonly passengerMetrics: PassengerMetrics;
}

/** Transport controls. Identities are stable; only `isBusy`/`error` move. */
export interface SimulationActionsValue {
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly start: () => void;
  readonly pause: () => void;
  readonly stop: () => void;
  readonly reset: () => void;
  readonly setSpeed: (value: number) => void;
}

/** Static network topology. Changes once, on load. */
export interface NetworkValue {
  readonly lines: readonly Line[];
  readonly stations: readonly Station[];
  readonly tracks: readonly Track[];
  readonly interchanges: readonly Interchange[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface LineVisibilityValue {
  readonly hiddenLineCodes: ReadonlySet<string>;
  readonly toggleLine: (code: string) => void;
  readonly showAllLines: () => void;
}

export interface DisruptionActionsValue {
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly create: (request: CreateDisruptionRequest) => void;
  readonly cancel: (id: number) => void;
}

/**
 * What the operator is looking at.
 *
 * Lifted out of the page and out of the map so the roster on /operations, the map on /, and the
 * search palette in the navbar all agree on the selection across a route change. `focusToken` is
 * the existing re-focus pulse: it increments on every selection so the map re-centres even when
 * the same target is picked twice.
 */
export interface SelectionValue {
  readonly selectedTrainId: number | null;
  readonly selectedStationId: number | null;
  readonly focusToken: number;
  readonly selectTrain: (id: number | null) => void;
  readonly selectStation: (id: number | null) => void;
}
