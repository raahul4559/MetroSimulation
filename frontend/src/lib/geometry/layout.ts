import type { Station } from "@/domain/metro";
import type { Projector } from "./projection";

/**
 * The map's fixed coordinate space.
 *
 * Every world coordinate the projector produces is expressed in this viewBox, so anything that
 * needs to compute a framing — the map itself, and the transition owner that hands off to the 3D
 * view — has to agree on it. It lives here rather than inside MetroMap so there is one definition
 * rather than two copies that can drift.
 */
export const MAP_VIEWPORT = { width: 800, height: 600, padding: 60 } as const;

export function viewBoxString(width: number, height: number): string {
  return `0 0 ${width} ${height}`;
}

/** SVG polyline path string through a line's ordered stations. */
export function buildLinePath(stations: readonly Station[], project: Projector): string {
  return stations
    .map((station, index) => {
      const { x, y } = project(station);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}
