import type { Station } from "./station";
import type { Line } from "./line";
import type { Track } from "./track";
import type { Interchange } from "./interchange";

export interface MetroNetworkData {
  readonly stations: readonly Station[];
  readonly lines: readonly Line[];
  readonly tracks: readonly Track[];
  readonly interchanges: readonly Interchange[];
}
