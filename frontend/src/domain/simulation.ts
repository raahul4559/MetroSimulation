export type SimulationStatus = "STOPPED" | "RUNNING" | "PAUSED";

export interface Simulation {
  readonly status: SimulationStatus;
  readonly currentTick: number;
  readonly elapsedSimulationMs: number;
  readonly tickIntervalMs: number;
  readonly timeScale: number;
}
