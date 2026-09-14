import type { Station } from "./station";
import type { Track } from "./track";

export interface Route {
  readonly stations: readonly Station[];
  readonly tracks: readonly Track[];
  readonly totalDistanceMetres: number;
  readonly totalTravelTimeSeconds: number;
}
