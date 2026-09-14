export type StationType = "REGULAR" | "INTERCHANGE" | "TERMINAL";

export interface Station {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly lines: readonly string[];
  readonly stationType: StationType;
  readonly dwellTimeSeconds: number;
}
