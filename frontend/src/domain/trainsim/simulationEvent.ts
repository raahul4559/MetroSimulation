export type SimulationEventType =
  | "DISPATCHED"
  | "DWELL_STARTED"
  | "DEPARTED"
  | "ARRIVED"
  | "HELD_FOR_HEADWAY"
  | "DELAYED"
  | "ROUTE_COMPLETED";

/** Mirrors the backend's `SimulationEventResponse`, broadcast on `/topic/train-simulation/events`. */
export interface SimulationEvent {
  readonly tick: number;
  readonly simulationTime: string;
  readonly type: SimulationEventType;
  readonly trainId: number;
  readonly trainCode: string;
  readonly stationId: number | null;
  readonly message: string;
}
