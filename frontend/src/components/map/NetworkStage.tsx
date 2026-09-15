"use client";

import { useMemo, useState } from "react";
import { buildProjector } from "@/lib/geometry/projection";
import type { ViewTransform } from "@/lib/geometry/viewport";
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

  /**
   * The map's framing at the moment 3D was requested, remembered by value rather than by keeping a
   * hidden map mounted. A mounted-but-invisible map would keep re-rendering every train marker on
   * every simulation tick behind an opaque canvas, for nothing.
   */
  const [returnTransform, setReturnTransform] = useState<ViewTransform | undefined>(undefined);

  const project = useMemo(() => buildProjector(stations, MAP_VIEWPORT), [stations]);
  const station = immersionStation(immersion);
  const config = useMemo(
    () => (station ? getStationConfig(station, lines) : null),
    [station, lines],
  );

  const sceneLoad = useStationSceneLoad({ config, phase: immersion.phase, sceneReady });

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
          className="absolute inset-0 transition-[opacity,transform,filter] duration-(--duration-cinematic) ease-(--ease-out) will-change-transform"
          style={{
            opacity: 1 - mapLayerProgress(immersion) * 0.9,
            transform: `scale(${1 + mapLayerProgress(immersion) * 0.12})`,
            filter: `blur(${mapLayerProgress(immersion) * 8}px)`,
          }}
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
            onToggleLine={toggleLine}
            selectedTrainId={selectedTrainId}
            onSelectTrain={selectTrain}
            selectedStationId={selectedStationId}
            onSelectStation={selectStation}
            focusToken={focusToken}
            onEnter3D={(target, from) => {
              setReturnTransform(from);
              enter(target, from, centerOn(project(target), IMMERSION_ENTER_SCALE, MAP_VIEWPORT));
            }}
            initialTransform={returnTransform}
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
          className="absolute inset-0 transition-[opacity,transform] duration-(--duration-cinematic) ease-(--ease-out) will-change-transform"
          style={{
            opacity: sceneLayerProgress(immersion),
            transform: `scale(${1.06 - sceneLayerProgress(immersion) * 0.06})`,
            pointerEvents: immersion.phase === "immersed" ? "auto" : "none",
          }}
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

      {immersion.phase === "map" && (
        <div className="pointer-events-none absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
          <div className="flex flex-col gap-2">
            <NetworkStatusCard
              stationCount={stations.length}
              trains={trains}
              disruptions={disruptions}
              isRunning={clock.status === "RUNNING"}
            />
          </div>
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
