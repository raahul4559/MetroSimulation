"use client";

import { useMemo } from "react";
import { buildProjector } from "@/lib/geometry/projection";
import { MAP_VIEWPORT } from "@/lib/geometry/layout";
import { centerOn } from "@/lib/geometry/viewport";
import {
  IMMERSION_ENTER_SCALE,
  immersionStation,
  isMapMounted,
  isSceneMounted,
  isTransitioning,
  mapLayerProgress,
  sceneLayerProgress,
  scrimOpacity,
} from "@/domain/stationImmersion";
import { getStationConfig } from "@/config/stations/stationConfigs";
import { useNetworkData, useSimulationData, useLineVisibilityContext, useTrainSelection } from "@/providers/SimulationProvider";
import { useStationImmersion } from "@/hooks/useStationImmersion";
import { useStationSceneLoad } from "@/hooks/useStationSceneLoad";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { Skeleton } from "@/components/ui/Skeleton";
import { MetroMap } from "./MetroMap";
import { MapLegend } from "./MapLegend";
import { NetworkStatusCard } from "./NetworkStatusCard";
import { StationScene } from "@/components/station3d/StationScene";
import { StationTransitionOverlay } from "@/components/station3d/StationTransitionOverlay";

/**
 * The network view: the 2D map, the 3D station, and the cinematic hand-off between them.
 *
 * This component exists because the hand-off has to be owned by something that outlives both
 * sides of it. Previously the map simply unmounted and the scene mounted in its place, which made
 * three things impossible: overlapping them during the change, showing progress while the scene
 * warmed up, and restoring the map's framing on return (its viewport state died with it).
 *
 * The mechanism, in order:
 *   1. The operator asks for 3D. The map reports the request along with its current framing.
 *   2. The map eases in to the station. The 3D scene mounts behind a scrim and starts warming.
 *   3. Once the scene has genuinely painted, the scrim dissolves and the scene arrives.
 *   4. On the way out, the reverse — and the map re-mounts at the framing it was left at, then
 *      eases back to where the operator had it.
 *
 * There is no shared WebGL canvas and there never was. The apparent camera movement is a CSS
 * transform on the two layer wrappers — the map pushes past the viewer while the scene settles
 * into place. That is deliberate rather than a shortcut: `CameraController` sets the three.js
 * camera synchronously during render so a freshly-keyed `OrbitControls` constructs against the
 * right position, and animating the camera from outside that arrangement desynchronises the two
 * (its own JSDoc names the bugs that caused).
 */
export function NetworkStage() {
  const { lines, stations, tracks, isLoading, error } = useNetworkData();
  const { trains, signals, passengers, disruptions, clock } = useSimulationData();
  const { hiddenLineCodes, toggleLine } = useLineVisibilityContext();
  const { selectedTrainId, selectedStationId, focusToken, selectTrain, selectStation } =
    useTrainSelection();

  const reducedMotion = usePrefersReducedMotion();
  const { immersion, cameraMove, sceneReady, enter, exit, onCameraMoveComplete, onSceneReady } =
    useStationImmersion(reducedMotion);

  const project = useMemo(() => buildProjector(stations, MAP_VIEWPORT), [stations]);
  const station = immersionStation(immersion);
  const config = useMemo(
    () => (station ? getStationConfig(station, lines) : null),
    [station, lines],
  );

  const sceneLoad = useStationSceneLoad({ config, phase: immersion.phase, sceneReady });

  /** How far each layer has travelled through the hand-off, 0..1. */
  const mapDepth = mapLayerProgress(immersion);
  const sceneDepth = sceneLayerProgress(immersion);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col gap-3 p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {isMapMounted(immersion) && (
        <div
          className="absolute inset-0 transition-[opacity,transform,filter] duration-(--duration-cinematic) ease-(--ease-out)"
          /*
           * At rest this layer carries no transform and no filter at all, rather than an identity
           * scale. A transform — even scale(1) — makes the element a containing block for its
           * `position: fixed` descendants, which would silently re-anchor the station bottom sheet
           * and its scrim to the map instead of the viewport.
           */
          style={
            mapDepth === 0
              ? { opacity: 1 }
              : {
                  opacity: 1 - mapDepth * 0.9,
                  transform: `scale(${1 + mapDepth * 0.12})`,
                  filter: `blur(${mapDepth * 8}px)`,
                  willChange: "transform, opacity, filter",
                }
          }
          aria-hidden={immersion.phase !== "map"}
          inert={immersion.phase !== "map"}
        >
          <MetroMap
            lines={lines}
            stations={stations}
            tracks={tracks}
            trains={trains}
            signals={signals}
            passengers={passengers}
            hiddenLineCodes={hiddenLineCodes}
            selectedTrainId={selectedTrainId}
            onSelectTrain={selectTrain}
            selectedStationId={selectedStationId}
            onSelectStation={selectStation}
            focusToken={focusToken}
            onEnter3D={(target, from) =>
              enter(target, from, centerOn(project(target), IMMERSION_ENTER_SCALE, MAP_VIEWPORT))
            }
            /*
             * On the way back, the map re-mounts at the close framing the 3D view replaced, then
             * eases out to where the operator actually had it. Mounting it at the *return* framing
             * instead would mean there is nothing left to animate — the reverse move would be a
             * cut, which is the thing this whole sequence exists to avoid.
             */
            initialTransform={
              immersion.phase === "exit-zooming" ? immersion.enterTransform : undefined
            }
            cameraMove={cameraMove}
            onCameraMoveComplete={onCameraMoveComplete}
          />
        </div>
      )}

      {station && isSceneMounted(immersion) && (
        /*
         * Never `hidden`, `display:none` or `visibility:hidden` while warming up. R3F's <Canvas>
         * sizes itself from a resize observer on its parent; a zero-size parent yields a 0x0
         * canvas that never runs useFrame, so the readiness signal never fires and the machine
         * deadlocks in `preparing` until the bail-out timer rescues it. Laid out and transparent.
         */
        <div
          className="absolute inset-0 transition-[opacity,transform] duration-(--duration-cinematic) ease-(--ease-out)"
          style={
            sceneDepth === 1
              ? { opacity: 1, pointerEvents: immersion.phase === "immersed" ? "auto" : "none" }
              : {
                  opacity: sceneDepth,
                  transform: `scale(${1.06 - sceneDepth * 0.06})`,
                  pointerEvents: "none",
                  willChange: "transform, opacity",
                }
          }
          aria-hidden={immersion.phase !== "immersed"}
        >
          <StationScene
            station={station}
            lines={lines}
            stations={stations}
            trains={trains}
            passengers={passengers}
            disruptions={disruptions}
            clock={clock}
            onBack={exit}
            onReady={onSceneReady}
            chromeHidden={immersion.phase !== "immersed"}
          />
        </div>
      )}

      {/*
        The map's own chrome column. Legend and status card share one stack rather than each
        claiming the bottom-left corner independently — they used to overlap at narrow widths.
        Hidden below `sm`, where the map needs every pixel and the bottom sheet covers this corner
        anyway; the same line filter is always reachable from /operations.
      */}
      {immersion.phase === "map" && (
        <div className="pointer-events-none absolute bottom-3 left-3 hidden flex-col gap-2 sm:flex sm:bottom-4 sm:left-4">
          <MapLegend lines={lines} hiddenLineCodes={hiddenLineCodes} onToggleLine={toggleLine} />
          <NetworkStatusCard
            stationCount={stations.length}
            trains={trains}
            disruptions={disruptions}
            isRunning={clock.status === "RUNNING"}
          />
        </div>
      )}

      {station && config && isTransitioning(immersion) && (
        <StationTransitionOverlay
          station={station}
          config={config}
          lines={lines}
          load={sceneLoad}
          opacity={scrimOpacity(immersion)}
        />
      )}
    </div>
  );
}
