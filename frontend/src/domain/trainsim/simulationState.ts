import type { SimulationClock } from "./simulationClock";
import type { SimulationTrainState } from "./trainState";
import type { Signal } from "./signal";
import type { Passenger, PassengerMetrics } from "./passenger";
import type { Disruption } from "./disruption";

/** Mirrors the backend's `SimulationStateResponse` — `GET /api/simulation/state` and the control
 * endpoints' replies. Views render the canonical `MetroStateFrame` instead. */
export interface SimulationState {
  readonly clock: SimulationClock;
  readonly trains: readonly SimulationTrainState[];
  readonly signals: readonly Signal[];
  readonly passengers: readonly Passenger[];
  readonly passengerMetrics: PassengerMetrics;
  readonly disruptions: readonly Disruption[];
}
