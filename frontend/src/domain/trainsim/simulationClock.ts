export type TrainSimStatus = "STOPPED" | "RUNNING" | "PAUSED";

export const SIMULATION_SPEEDS = [0.5, 1, 2, 5, 10, 50] as const;
export type SimulationSpeedValue = (typeof SIMULATION_SPEEDS)[number];

/** Mirrors the backend's `SimulationClockResponse`. */
export interface SimulationClock {
  readonly startTime: string;
  readonly currentTime: string;
  readonly status: TrainSimStatus;
  readonly speed: number;
  readonly currentTick: number;
  readonly elapsedSimulationSeconds: number;
}
