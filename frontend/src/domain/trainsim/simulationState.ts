import type { SimulationClock } from "./simulationClock";
import type { TrainState } from "./trainState";
import type { Signal } from "./signal";
import type { Passenger, PassengerMetrics } from "./passenger";
import type { Disruption } from "./disruption";

/** Mirrors the backend's `SimulationStateResponse` — `GET /api/simulation/state`. */
export interface SimulationState {
  readonly clock: SimulationClock;
  readonly trains: readonly TrainState[];
  readonly signals: readonly Signal[];
  readonly passengers: readonly Passenger[];
  readonly passengerMetrics: PassengerMetrics;
  readonly disruptions: readonly Disruption[];
}
