export type TrainStatus = "IDLE" | "IN_SERVICE" | "DWELLING" | "OUT_OF_SERVICE";

export interface Train {
  readonly id: number;
  readonly code: string;
  readonly lineId: number;
  readonly capacity: number;
  readonly status: TrainStatus;
  readonly currentTrackId: number | null;
}
