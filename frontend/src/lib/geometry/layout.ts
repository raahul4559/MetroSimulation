import type { Station } from "@/domain/metro";
import type { Projector } from "./projection";

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
