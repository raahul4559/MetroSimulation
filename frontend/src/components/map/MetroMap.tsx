"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Line, Station, Track } from "@/domain/metro";
import type { Passenger, Signal, TrainState } from "@/domain/trainsim";
import type { ConnectionStatus } from "@/lib/ws/simulation-socket";
import { buildProjector } from "@/lib/geometry/projection";
import { viewBoxString } from "@/lib/geometry/layout";
import { isStationVisible, shouldShowLabel } from "@/lib/metro/visibility";
import { interpolateTrainPoint, signalAnchorPoint } from "@/lib/metro/trainPosition";
import { buildStationQueueCounts } from "@/lib/metro/passengerDisplay";
import { useMapViewport } from "@/hooks/useMapViewport";
import { MetroLine } from "./MetroLine";
import { StationMarker } from "./StationMarker";
import { StationLabel } from "./StationLabel";
import { TrainMarker } from "./TrainMarker";
import { SignalMarker } from "./SignalMarker";
import { MapControls } from "./MapControls";
import { StationPanel } from "./StationPanel";

const VIEWPORT = { width: 800, height: 600, padding: 60 };

interface MetroMapProps {
  lines: readonly Line[];
  stations: readonly Station[];
  tracks: readonly Track[];
  trains: readonly TrainState[];
  signals: readonly Signal[];
  passengers: readonly Passenger[];
  connectionStatus: ConnectionStatus;
  hiddenLineCodes: ReadonlySet<string>;
  onToggleLine: (code: string) => void;
  selectedTrainId: number | null;
  onSelectTrain: (id: number | null) => void;
  focusToken: number;
}

/**
 * The primary interactive network map: renders lines, stations, labels, and live trains from
 * backend data, and owns pan/zoom and station selection (line visibility and train selection are
 * lifted to the caller so `LineFilter`/`TrainList` can share them). No business logic lives here —
 * projection, adjacency, visibility, and train-position interpolation all come from `lib/geometry`
 * and `lib/metro`.
 */
export function MetroMap({
  lines,
  stations,
  tracks,
  trains,
  signals,
  passengers,
  connectionStatus,
  hiddenLineCodes,
  onToggleLine,
  selectedTrainId,
  onSelectTrain,
  focusToken,
}: MetroMapProps) {
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  const project = useMemo(() => buildProjector(stations, VIEWPORT), [stations]);
  const uniqueStations = useMemo(() => {
    const byId = new Map(stations.map((station) => [station.id, station]));
    return [...byId.values()];
  }, [stations]);
  const stationsById = useMemo(
    () => new Map(uniqueStations.map((station) => [station.id, station])),
    [uniqueStations]
  );
  const lineByCode = useMemo(() => new Map(lines.map((line) => [line.code, line])), [lines]);
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const stationQueueCounts = useMemo(() => buildStationQueueCounts(passengers), [passengers]);

  const { svgRef, scale, transform, zoomIn, zoomOut, fitNetwork, focusOn, panHandlers } =
    useMapViewport(VIEWPORT);
  const [labelsVisible, setLabelsVisible] = useState(true);

  const visibleLines = lines.filter((line) => !hiddenLineCodes.has(line.code));
  const visibleTrains = trains.filter((train) => !hiddenLineCodes.has(train.lineCode));
  const selectedStation = uniqueStations.find((s) => s.id === selectedStationId) ?? null;

  const trainsRef = useRef(trains);
  useEffect(() => {
    trainsRef.current = trains;
  }, [trains]);

  useEffect(() => {
    if (selectedTrainId == null) return;
    const train = trainsRef.current.find((t) => t.id === selectedTrainId);
    if (!train) return;
    const point = interpolateTrainPoint(train, stationsById, project);
    if (point) focusOn(point);
    // Re-run only when the caller explicitly asks to (re-)focus — not every tick a train moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, selectedTrainId]);

  const deselectAll = () => {
    setSelectedStationId(null);
    onSelectTrain(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-slate-950">
      <svg
        ref={svgRef}
        viewBox={viewBoxString(VIEWPORT.width, VIEWPORT.height)}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        role="img"
        aria-label="Namma Metro network map"
        onClick={deselectAll}
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
                waitingCount={stationQueueCounts.get(station.id) ?? 0}
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
          {signals.map((signal) => {
            const track = tracksById.get(signal.trackId);
            if (!track || hiddenLineCodes.has(track.lineCode)) return null;
            const point = signalAnchorPoint(track, stationsById, project);
            if (!point) return null;
            return <SignalMarker key={signal.id} signal={signal} point={point} scale={scale} />;
          })}
          {visibleTrains.map((train) => {
            const point = interpolateTrainPoint(train, stationsById, project);
            if (!point) return null;
            return (
              <TrainMarker
                key={train.id}
                train={train}
                point={point}
                scale={scale}
                colorHex={lineByCode.get(train.lineCode)?.colorHex ?? "#94a3b8"}
                selected={train.id === selectedTrainId}
                onSelect={(t) => onSelectTrain(t.id)}
              />
            );
          })}
        </g>
      </svg>

      <MapControls
        lines={lines}
        hiddenLineCodes={hiddenLineCodes}
        onToggleLine={onToggleLine}
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
          trains={trains}
          passengers={passengers}
          liveFeedStatus={connectionStatus}
          onClose={() => setSelectedStationId(null)}
        />
      )}
    </div>
  );
}
