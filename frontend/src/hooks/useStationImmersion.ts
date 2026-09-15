"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Station } from "@/domain/metro";
import {
  IMMERSION_MAP,
  IMMERSION_TIMINGS,
  type StationImmersion,
} from "@/domain/stationImmersion";
import type { ViewTransform } from "@/lib/geometry/viewport";

export interface MapCameraMove {
  /** Identifies the move so a re-render can never replay it — same idiom as `focusToken`. */
  readonly token: number;
  readonly target: ViewTransform;
  readonly durationMs: number;
}

export interface StationImmersionController {
  readonly immersion: StationImmersion;
  readonly cameraMove: MapCameraMove | undefined;
  /** Begin entering a station. `from` is the framing on screen at the moment of the request. */
  readonly enter: (station: Station, from: ViewTransform, enterTransform: ViewTransform) => void;
  readonly exit: () => void;
  /** Called by the map when a camera move it was asked to perform has finished. */
  readonly onCameraMoveComplete: (token: number) => void;
  /** Called by the 3D scene once it has genuinely painted and its assets have resolved. */
  readonly onSceneReady: () => void;
}

/**
 * Drives the map → 3D hand-off.
 *
 * All phase timers live in one effect keyed on the phase, with a `clearTimeout` cleanup, so an
 * abort — a route change, an unmount, the operator leaving — can never leave a pending advance
 * that fires into a dead component.
 *
 * `reducedMotion` collapses every movement to zero duration. The overlay still appears while
 * assets load; it simply cuts instead of dollying. This has to be decided in JS rather than CSS:
 * the map camera is a requestAnimationFrame tween, which a media query cannot reach.
 */
export function useStationImmersion(reducedMotion: boolean): StationImmersionController {
  const [immersion, setImmersion] = useState<StationImmersion>(IMMERSION_MAP);
  const [cameraMove, setCameraMove] = useState<MapCameraMove | undefined>(undefined);
  /** The 3D scene has painted and its assets have resolved. */
  const [sceneReady, setSceneReady] = useState(false);
  /** The minimum time in `preparing` has passed. */
  const [floorElapsed, setFloorElapsed] = useState(false);

  /** The live phase, for timers that need to read it without becoming a dependency. */
  const immersionRef = useRef(immersion);
  useEffect(() => {
    immersionRef.current = immersion;
  }, [immersion]);

  const cameraTokenRef = useRef(0);
  /** The token whose completion should advance the machine, so a stale move cannot. */
  const awaitedTokenRef = useRef<number | null>(null);

  const duration = useCallback((ms: number) => (reducedMotion ? 0 : ms), [reducedMotion]);

  const issueCameraMove = useCallback((target: ViewTransform, durationMs: number) => {
    const token = (cameraTokenRef.current += 1);
    awaitedTokenRef.current = token;
    setCameraMove({ token, target, durationMs });
  }, []);

  const enter = useCallback(
    (station: Station, from: ViewTransform, enterTransform: ViewTransform) => {
      setSceneReady(false);
      setFloorElapsed(false);
      setImmersion({ phase: "zooming-in", station, returnTransform: from, enterTransform });
      issueCameraMove(enterTransform, duration(IMMERSION_TIMINGS.zoomInMs));
    },
    [duration, issueCameraMove],
  );

  const exit = useCallback(() => {
    setImmersion((current) =>
      current.phase === "immersed" ? { ...current, phase: "exit-fading" } : current,
    );
  }, []);

  const onCameraMoveComplete = useCallback((token: number) => {
    if (awaitedTokenRef.current !== token) return;
    awaitedTokenRef.current = null;
    setImmersion((current) => {
      if (current.phase === "zooming-in") return { ...current, phase: "preparing" };
      if (current.phase === "exit-zooming") return IMMERSION_MAP;
      return current;
    });
  }, []);

  const onSceneReady = useCallback(() => setSceneReady(true), []);

  const reveal = useCallback(() => {
    setImmersion((c) => (c.phase === "preparing" ? { ...c, phase: "revealing" } : c));
  }, []);

  /**
   * `preparing` is bounded at both ends: the floor stops a warm station flashing the overlay for a
   * single frame, and the ceiling guarantees a stalled asset can never strand the operator behind
   * it. Whichever of "ready after the floor" and "ceiling reached" happens first wins.
   */
  useEffect(() => {
    if (immersion.phase !== "preparing") return;
    const floor = window.setTimeout(() => setFloorElapsed(true), duration(IMMERSION_TIMINGS.prepareMinMs));
    const ceiling = window.setTimeout(reveal, duration(IMMERSION_TIMINGS.prepareMaxMs));
    return () => {
      window.clearTimeout(floor);
      window.clearTimeout(ceiling);
    };
  }, [immersion.phase, duration, reveal]);

  useEffect(() => {
    if (immersion.phase !== "preparing" || !floorElapsed || !sceneReady) return;
    // Deferred a microtask so this is an async transition rather than a synchronous setState in an
    // effect body — the same pattern used by useStationAsset and useStationReferences.
    void Promise.resolve().then(reveal);
  }, [immersion.phase, floorElapsed, sceneReady, reveal]);

  /** Time-driven advances. One effect, one cleanup — an abort can never leave a pending phase. */
  useEffect(() => {
    if (immersion.phase === "revealing") {
      const timer = window.setTimeout(
        () => setImmersion((c) => (c.phase === "revealing" ? { ...c, phase: "immersed" } : c)),
        duration(IMMERSION_TIMINGS.revealMs),
      );
      return () => window.clearTimeout(timer);
    }

    if (immersion.phase === "exit-fading") {
      const timer = window.setTimeout(() => {
        // Read the phase from the ref rather than from a setState updater: issuing the camera move
        // is a side effect, and an updater must stay pure (React may invoke it twice).
        const current = immersionRef.current;
        if (current.phase !== "exit-fading") return;
        issueCameraMove(current.returnTransform, duration(IMMERSION_TIMINGS.exitZoomMs));
        setImmersion({ ...current, phase: "exit-zooming" });
      }, duration(IMMERSION_TIMINGS.exitFadeMs));
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [immersion.phase, duration, issueCameraMove]);

  return { immersion, cameraMove, enter, exit, onCameraMoveComplete, onSceneReady };
}
