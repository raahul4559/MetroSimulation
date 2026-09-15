"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Line, Station, Track } from "@/domain/metro";
import type { Passenger, Signal, TrainState } from "@/domain/trainsim";
import { buildProjector } from "@/lib/geometry/projection";
import { MAP_VIEWPORT, viewBoxString } from "@/lib/geometry/layout";
import type { ViewTransform } from "@/lib/geometry/viewport";
import { isStationVisible, shouldShowLabel } from "@/lib/metro/visibility";
import { interpolateTrainPoint, signalAnchorPoint } from "@/lib/metro/trainPosition";
import { buildStationQueueCounts } from "@/lib/metro/passengerDisplay";
import { useMapViewport } from "@/hooks/useMapViewport";
import { useMapPreferences } from "@/hooks/useMapPreferences";
import type { MapCameraMove } from "@/hooks/useStationImmersion";
import { MetroLine } from "./MetroLine";
import { StationMarker } from "./StationMarker";
import { StationLabel } from "./StationLabel";
import { TrainMarker } from "./TrainMarker";
import { SignalMarker } from "./SignalMarker";
import { MapZoomControls } from "./MapZoomControls";
import { StationPanel } from "./StationPanel";

interface MetroMapProps {
  lines: readonly Line[];
  stations: readonly Station[];
  tracks: readonly Track[];
  trains: readonly TrainState[];
  signals: readonly Signal[];
  passengers: readonly Passenger[];
  hiddenLineCodes: ReadonlySet<string>;
  selectedTrainId: number | null;
  onSelectTrain: (id: number | null) => void;
  selectedStationId: number | null;
  onSelectStation: (id: number | null) => void;
  focusToken: number;
  /**
   * Fires the instant the operator asks for the 3D view, BEFORE any camera move — the caller owns
   * the whole hand-off from there. `from` is the framing on screen at that moment, so the caller
   * can restore it on the way back out.
   *
   * Present only when the caller supports the 3D station view; offering it is optional so this
   * component still works standalone without it.
   */
  onEnter3D?: ((station: Station, from: ViewTransform) => void) | undefined;
  /** Framing this instance starts at. Defaults to fit-network. */
  initialTransform?: ViewTransform | undefined;
  /** A camera move the caller wants performed, identified by token so re-renders never replay it. */
  cameraMove?: MapCameraMove | undefined;
  onCameraMoveComplete?: ((token: number) => void) | undefined;
}

/**
 * The primary interactive network map: renders lines, stations, labels, and live trains from
 * backend data, and owns pan/zoom — and only pan/zoom. Line visibility, train selection and
 * station selection are all lifted to the caller so the roster, the search palette and the map
 * never disagree, and the map legend lives with the caller for the same reason. No business logic
 * lives here — projection, adjacency, visibility, and train-position interpolation all come from
 * `lib/geometry` and `lib/metro`.
 *
 * Note what this component does NOT decide: whether entering a station animates, and how. It
 * reports the request and executes camera moves it is handed. The map never re-renders based on
 * the 3D view — there is no shared canvas — so the sense of one continuous camera move comes
 * entirely from the caller sequencing this map's zoom against the 3D layer's arrival (see
 * `NetworkStage`).
 */
export function MetroMap({
  lines,
  stations,
  tracks,
  trains,
  signals,
  passengers,
  hiddenLineCodes,
  selectedTrainId,
  onSelectTrain,
  selectedStationId,
  onSelectStation,
  focusToken,
  onEnter3D,
  initialTransform,
  cameraMove,
  onCameraMoveComplete,
}: MetroMapProps) {
  const [preferences] = useMapPreferences();

  const project = useMemo(() => buildProjector(stations, MAP_VIEWPORT), [stations]);
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

  const { svgRef, scale, transform, zoomIn, zoomOut, fitNetwork, focusOn, animateTo, panHandlers } =
    useMapViewport(MAP_VIEWPORT, initialTransform ? { initialTransform } : {});

  const visibleLines = lines.filter((line) => !hiddenLineCodes.has(line.code));
  const visibleTrains = trains.filter((train) => !hiddenLineCodes.has(train.lineCode));

  /**
   * A selection dims everything that is not part of it, so the eye lands on the thing the operator
   * chose rather than on whatever happens to be brightest. `MetroLine` has always accepted a
   * `dimmed` prop; nothing ever passed it.
   */
  const selectedStation = uniqueStations.find((s) => s.id === selectedStationId) ?? null;
  const selectedTrain = trains.find((t) => t.id === selectedTrainId) ?? null;
  const focusedLineCodes: ReadonlySet<string> | null = selectedStation
    ? new Set(selectedStation.lines)
    : selectedTrain
      ? new Set([selectedTrain.lineCode])
      : null;
  const isDimmed = (lineCode: string) =>
    focusedLineCodes !== null && !focusedLineCodes.has(lineCode);
  const isStationDimmed = (station: Station) =>
    focusedLineCodes !== null && !station.lines.some((code) => focusedLineCodes.has(code));

  const trainsRef = useRef(trains);
  useEffect(() => {
    trainsRef.current = trains;
  }, [trains]);

  useEffect(() => {
    if (selectedTrainId == null) return;
    // A transition owns the camera while it runs; a selection must not yank it mid-move.
    if (cameraMove) return;
    const train = trainsRef.current.find((t) => t.id === selectedTrainId);
    if (!train) return;
    const point = interpolateTrainPoint(train, stationsById, project);
    if (point) focusOn(point);
    // Re-run only when the caller explicitly asks to (re-)focus — not every tick a train moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, selectedTrainId]);

  /**
   * A station picked from the search palette is somewhere off screen, so the map has to go find
   * it. A station clicked *on the map* is already under the operator's cursor — re-centring and
   * zooming it there would yank the view out from under them for no reason. This ref is how the
   * map tells the two apart: it records what it selected itself, and skips exactly that one.
   */
  const locallyPickedStationRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedStationId == null || cameraMove) return;
    if (locallyPickedStationRef.current === selectedStationId) {
      locallyPickedStationRef.current = null;
      return;
    }
    const station = stationsById.get(selectedStationId);
    if (station) focusOn(project(station), 2.4, { animate: true, durationMs: 420 });
    // Driven by the focus pulse, not by every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, selectedStationId]);

  useEffect(() => {
    if (!cameraMove) return;
    const { token, target, durationMs } = cameraMove;
    animateTo(target, { durationMs, onComplete: () => onCameraMoveComplete?.(token) });
    // Keyed on the token alone so a re-render can never replay a move that already ran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraMove?.token]);

  const deselectAll = () => {
    onSelectStation(null);
    onSelectTrain(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas">
      <svg
        ref={svgRef}
        viewBox={viewBoxString(MAP_VIEWPORT.width, MAP_VIEWPORT.height)}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        role="img"
        aria-label="Namma Metro network map"
        onClick={deselectAll}
        {...panHandlers}
      >
        <g transform={`translate(${transform.tx} ${transform.ty}) scale(${transform.scale})`}>
          {visibleLines.map((line) => (
            <MetroLine key={line.id} line={line} project={project} dimmed={isDimmed(line.code)} />
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
                showDensity={preferences.densityVisible}
                dimmed={isStationDimmed(station)}
                onSelect={(s) => {
                  locallyPickedStationRef.current = s.id;
                  onSelectStation(s.id);
                }}
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
                visible={shouldShowLabel(station, scale, preferences.labelsVisible)}
                active={station.id === selectedStationId}
                dimmed={isStationDimmed(station)}
              />
            ))}

          {preferences.signalsVisible &&
            signals.map((signal) => {
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
                dimmed={isDimmed(train.lineCode)}
                onSelect={(t) => onSelectTrain(t.id)}
              />
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute right-3 top-3 sm:right-4 sm:top-4">
        <MapZoomControls
          scale={scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitNetwork={fitNetwork}
        />
      </div>

      {selectedStation && (
        <StationPanel
          station={selectedStation}
          lines={lines}
          tracks={tracks}
          trains={trains}
          passengers={passengers}
          onClose={() => onSelectStation(null)}
          onEnter3D={onEnter3D ? (station) => onEnter3D(station, transform) : undefined}
        />
      )}
    </div>
  );
}
