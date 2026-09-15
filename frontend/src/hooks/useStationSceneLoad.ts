"use client";

import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import type { StationConfig } from "@/domain/stationConfig";
import { checkAssetExists } from "@/lib/station3d/assetAvailability";
import type { StationImmersionPhase } from "@/domain/stationImmersion";
import { SCENE_LOAD_MESSAGE, type SceneLoadStage, type StationSceneLoad } from "@/lib/station3d/sceneLoad";

// Re-exported for existing importers — the values now live in `lib/station3d/sceneLoad.ts` (see
// that file for why), but nothing outside this pair of files needs to know that moved.
export { SCENE_LOAD_MESSAGE };
export type { SceneLoadStage, StationSceneLoad };

/**
 * Where each stage's segment ends.
 *
 * The bands are fixed and the reported value is the *maximum* across all four segments, which is
 * what makes the bar monotonic by construction rather than by ratcheting a stored high-water mark.
 * Each segment only ever grows within one entry, and a fresh entry resets its inputs.
 */
const SEGMENT_END = { locating: 0.25, environment: 0.45, architecture: 0.9, entering: 1 } as const;

const ZOOM_SEGMENT_MS = 900;

/**
 * Composite load progress for a station's 3D scene.
 *
 * Deliberately not wired to drei's `useProgress` alone. That store is driven by
 * `THREE.DefaultLoadingManager`, which only sees `useGLTF` loads — it reports nothing for the
 * procedural environments, and nothing for the drei `<Text>` signage, which loads its fonts
 * through troika's own pipeline. More pointedly: no station in this project currently ships a
 * `.glb` at all, so `useProgress` never fires, and a bar bound to it alone would sit at zero
 * forever.
 *
 * So progress is composed from four gates the transition genuinely depends on, each clamped
 * monotonic. `useProgress.active` is consulted only once a model is known to exist, because it is
 * `false` *before* loading starts as well as after it finishes — "not active" is not "done".
 */
export function useStationSceneLoad(args: {
  readonly config: StationConfig | null;
  readonly phase: StationImmersionPhase;
  readonly sceneReady: boolean;
}): StationSceneLoad {
  const { config, phase, sceneReady } = args;
  const { active, progress: gltfProgress, loaded, total } = useProgress();

  const [assetsResolved, setAssetsResolved] = useState(false);
  const [modelAvailable, setModelAvailable] = useState(false);
  const [zoomProgress, setZoomProgress] = useState(0);

  const stationCode = config?.stationCode ?? null;

  // A fresh entry starts from zero. Keyed on the station so re-entering the same one still resets.
  useEffect(() => {
    void Promise.resolve().then(() => {
      setAssetsResolved(false);
      setModelAvailable(false);
      setZoomProgress(0);
    });
  }, [stationCode]);

  // Gate 2: does a real model answer? Same HEAD check `useStationAsset` performs inside the scene.
  // The duplicate request is a 404 that mostly hits the browser cache, and paying for it here keeps
  // StationScene's prop surface unchanged.
  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    void Promise.all([
      checkAssetExists(config.modelPath),
      checkAssetExists(config.environmentPath),
    ]).then(([model]) => {
      if (cancelled) return;
      setModelAvailable(model);
      setAssetsResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  // Gate 1: the map's zoom is the only thing happening during `zooming-in`, so drive the first
  // segment off elapsed time rather than leaving the bar at zero while the camera flies.
  useEffect(() => {
    if (phase !== "zooming-in") return;
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = (performance.now() - started) / ZOOM_SEGMENT_MS;
      setZoomProgress(Math.min(1, elapsed));
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  /*
   * `active` alone cannot say "the model finished" — it is false before loading starts as well as
   * after it ends. `total > 0` is the signal that the loading manager has actually seen work; only
   * then does `loaded >= total && !active` mean anything.
   */
  const modelSettled = !modelAvailable || (total > 0 && loaded >= total && !active);
  const ready = assetsResolved && modelSettled && sceneReady;

  const locatingSegment = zoomProgress * SEGMENT_END.locating;
  const environmentSegment = assetsResolved
    ? SEGMENT_END.environment
    : phase === "zooming-in"
      ? 0
      : SEGMENT_END.locating;
  const architectureSegment = !assetsResolved
    ? 0
    : modelAvailable
      ? SEGMENT_END.environment +
        (gltfProgress / 100) * (SEGMENT_END.architecture - SEGMENT_END.environment)
      : // Nothing to download — the procedural shell is built synchronously.
        SEGMENT_END.architecture;
  const enteringSegment = ready ? SEGMENT_END.entering : sceneReady ? SEGMENT_END.architecture : 0;

  const progress = Math.max(
    locatingSegment,
    environmentSegment,
    architectureSegment,
    enteringSegment,
  );

  const stage: SceneLoadStage = sceneReady
    ? "entering"
    : assetsResolved
      ? "architecture"
      : phase === "zooming-in"
        ? "locating"
        : "environment";

  return { progress, stage, ready, procedural: assetsResolved && !modelAvailable };
}
