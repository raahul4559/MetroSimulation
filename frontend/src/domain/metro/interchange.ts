import type { Station } from "./station";
import type { LineSummary } from "./line";

export interface Interchange {
  readonly station: Station;
  readonly connectedLines: readonly LineSummary[];
}
