"use client";

import { useMemo, useState } from "react";
import type { Line, Station, Track } from "@/domain/metro";
import type { ConnectionStatus } from "@/lib/ws/simulation-socket";
import { buildProjector } from "@/lib/geometry/projection";
import { viewBoxString } from "@/lib/geometry/layout";
import { isStationVisible, shouldShowLabel } from "@/lib/metro/visibility";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useLineVisibility } from "@/hooks/useLineVisibility";
import { MetroLine } from "./MetroLine";
import { StationMarker } from "./StationMarker";
import { StationLabel } from "./StationLabel";
import { MapControls } from "./MapControls";
import { StationPanel } from "./StationPanel";

const VIEWPORT = { width: 800, height: 600, padding: 60 };

interface MetroMapProps {
  lines: readonly Line[];
  stations: readonly Station[];
  tracks: readonly Track[];
  connectionStatus: ConnectionStatus;
}

/**
 * The primary interactive network map: renders lines, stations, and labels from backend data,
 * and owns pan/zoom, line/label visibility, and station selection. No business logic lives
 * here — projection, adjacency, and visibility rules all come from `lib/geometry` and
 * `lib/metro`.
 */
export function MetroMap({ lines, stations, tracks, connectionStatus }: MetroMapProps) {
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  const project = useMemo(() => buildProjector(stations, VIEWPORT), [stations]);
  const uniqueStations = useMemo(() => {
    const byId = new Map(stations.map((station) => [station.id, station]));
    return [...byId.values()];
  }, [stations]);

  const { svgRef, scale, transform, zoomIn, zoomOut, fitNetwork, panHandlers } =
    useMapViewport(VIEWPORT);
  const { hiddenLineCodes, toggleLine } = useLineVisibility();
  const [labelsVisible, setLabelsVisible] = useState(true);

  const visibleLines = lines.filter((line) => !hiddenLineCodes.has(line.code));
  const selectedStation = uniqueStations.find((s) => s.id === selectedStationId) ?? null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-slate-950">
      <svg
        ref={svgRef}
        viewBox={viewBoxString(VIEWPORT.width, VIEWPORT.height)}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Namma Metro network map"
        onClick={() => setSelectedStationId(null)}
        {...panHandlers}
      >
        <g transform={`translate(${transform.tx} ${transform.ty}) scale(${transform.scale})`}>
          {visibleLines.map((line) => (
            <MetroLine key={line.id} line={line} project={project} />
          ))}
          {uniqueStations
            .filter((station) => isStationVisible(station, hiddenLineCodes))
            .map((station) => (
              <StationMarker
                key={station.id}
                station={station}
                point={project(station)}
                scale={scale}
                selected={station.id === selectedStationId}
                onSelect={(s) => setSelectedStationId(s.id)}
              />
            ))}
          {uniqueStations
            .filter((station) => isStationVisible(station, hiddenLineCodes))
            .map((station) => (
              <StationLabel
                key={station.id}
                station={station}
                point={project(station)}
                scale={scale}
                visible={shouldShowLabel(station, scale, labelsVisible)}
              />
            ))}
        </g>
      </svg>

      <MapControls
        lines={lines}
        hiddenLineCodes={hiddenLineCodes}
        onToggleLine={toggleLine}
        labelsVisible={labelsVisible}
        onToggleLabels={() => setLabelsVisible((v) => !v)}
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitNetwork={fitNetwork}
      />

      {selectedStation && (
        <StationPanel
          station={selectedStation}
          lines={lines}
          stations={uniqueStations}
          tracks={tracks}
          liveFeedStatus={connectionStatus}
          onClose={() => setSelectedStationId(null)}
        />
      )}
    </div>
  );
}
