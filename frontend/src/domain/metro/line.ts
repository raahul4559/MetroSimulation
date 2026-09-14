import type { Station } from "./station";

export interface Line {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly colorHex: string;
  readonly stations: readonly Station[];
}

export interface LineSummary {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly colorHex: string;
}
