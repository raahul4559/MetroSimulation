import type { SimulationClock } from "./simulationClock";
import type { TrainState } from "./trainState";

/** Mirrors the backend's `SimulationStateResponse` — `GET /api/simulation/state`. */
export interface SimulationState {
  readonly clock: SimulationClock;
  readonly trains: readonly TrainState[];
}
