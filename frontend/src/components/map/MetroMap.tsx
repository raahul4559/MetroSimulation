import { useMemo } from "react";
import type { Line, Station } from "@/domain/metro";
import { buildProjector } from "@/lib/geometry/projection";
import { viewBoxString } from "@/lib/geometry/layout";
import { LinePath } from "./LinePath";
import { StationMarker } from "./StationMarker";

const VIEWPORT = { width: 800, height: 600, padding: 60 };

interface MetroMapProps {
  lines: readonly Line[];
  stations: readonly Station[];
}

export function MetroMap({ lines, stations }: MetroMapProps) {
  const project = useMemo(() => buildProjector(stations, VIEWPORT), [stations]);

  const uniqueStations = useMemo(() => {
    const byId = new Map(stations.map((station) => [station.id, station]));
    return [...byId.values()];
  }, [stations]);

  return (
    <svg
      viewBox={viewBoxString(VIEWPORT.width, VIEWPORT.height)}
      className="h-full w-full"
      role="img"
      aria-label="Namma Metro network schematic"
    >
      {lines.map((line) => (
        <LinePath key={line.id} line={line} project={project} />
      ))}
      {uniqueStations.map((station) => (
        <StationMarker key={station.id} station={station} project={project} />
      ))}
    </svg>
  );
}
