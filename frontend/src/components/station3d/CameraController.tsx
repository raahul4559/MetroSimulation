"use client";

import { useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraMode3D, StationLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import type { StationBuildType } from "@/domain/stationConfig";
import { trainPose3D } from "@/lib/station3d/position";
import { MODULE_SPACING, PLATFORM_HALF_LENGTH, TUNNEL_HEIGHT } from "@/lib/station3d/constants";

interface CameraControllerProps {
  mode: CameraMode3D;
  layout: StationLayout3D;
  trains: readonly TrainVisual3D[];
  /** An UNDERGROUND station's low tunnel ceiling needs its own, much tighter default framing —
   * the generic elevated/at-grade OVERVIEW preset flies the camera above and outside the tunnel
   * shell entirely, producing a black frame (no light source reaches outside the bore). */
  buildType: StationBuildType;
  /** Bumped by the "Reset Camera" button — re-snaps the current mode's framing even if the mode
   * itself hasn't changed. */
  resetToken: number;
}

const CAMERA_FOLLOW_LERP = 0.08;
/** Priority order for which train FOLLOW locks onto when several are visible at once — the one
 * doing the most "story," boarding/stopped ranked above a train still out on the approach. */
const FOLLOW_PRIORITY: readonly TrainPhase3D[] = ["BOARDING", "STOPPED", "ARRIVING", "APPROACHING", "DEPARTING"];

interface FramingPreset {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/** Rotates a local station-space point (x, z) by the station's real `orientationRadians` — the
 * same Y-rotation `StationModel` applies to the whole platform/track/environment group. The
 * camera itself is a top-level scene object, not a child of that rotated group, so every position/
 * target/look-at this controller computes in "local" coordinates (platform module x, track z) must
 * go through this before being handed to `camera.position`/`camera.lookAt` — otherwise, for any
 * station whose real bearing isn't ~0°, the camera frames empty space next to the actual (rotated)
 * geometry rather than the geometry itself. Caught in manual testing: Majestic's ~90° bearing made
 * the tight UNDERGROUND establishing shot point completely away from the platform. */
function rotateY(x: number, z: number, radians: number): readonly [number, number] {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos + z * sin, -x * sin + z * cos];
}

/**
 * Owns the camera for all four modes. OVERVIEW/FREE/PASSENGER hand the camera to drei's
 * `OrbitControls`; FOLLOW disables it and drives the camera itself every frame from the tracked
 * train's real pose (see `trainPose3D`) — the two never fight over the same camera in the same mode.
 *
 * <p>`OrbitControls` keeps its own internal orbit angle/distance that user dragging accumulates
 * into — it does NOT re-derive that state just because `camera.position` is set elsewhere, so
 * switching mode by mutating position alone leaves the *previous* mode's orbit angle in charge
 * (a real bug caught in manual testing: Passenger View inherited Overview's steep downward angle).
 * The fix is to force a **fresh** `OrbitControls` instance per mode (via `key`, with its initial
 * `target` passed as a controlled prop) and make sure `camera.position` is already correct
 * *before* that instance constructs — done synchronously during render (guarded by a small
 * previous-render comparison, React's own sanctioned "adjust state during render" pattern, so it
 * only fires on an actual mode/reset change and never on a re-render from live train data), not in
 * a `useEffect` whose ordering relative to the child `OrbitControls`' own mount isn't guaranteed.
 *
 * <p>FOLLOW with no train currently visible at this station (caught in the same manual testing —
 * the camera was left stranded wherever a *previous* mode had put it) falls back to the OVERVIEW
 * framing and stays on OrbitControls until a train actually appears; it never renders a "tracking
 * nothing" empty frame.
 */
export function CameraController({ mode, layout, trains, buildType, resetToken }: CameraControllerProps) {
  const { camera } = useThree();
  const underground = buildType === "UNDERGROUND";

  const stationCenterX = ((layout.platforms.length - 1) * MODULE_SPACING) / 2;
  const firstModuleX = (layout.platforms[0]?.moduleIndex ?? 0) * MODULE_SPACING;

  const followTarget = useMemo(() => pickFollowTrain(trains), [trains]);
  const isTrackingTrain = mode === "FOLLOW" && followTarget != null;

  const framing = useMemo<FramingPreset>(() => {
    const theta = layout.orientationRadians;
    const toWorld = (x: number, y: number, z: number): readonly [number, number, number] => {
      const [wx, wz] = rotateY(x, z, theta);
      return [wx, y, wz];
    };

    if (mode === "FREE") {
      return underground
        ? { position: toWorld(stationCenterX - 6, 6.5, 20), target: toWorld(stationCenterX, 1.5, 0) }
        : { position: toWorld(stationCenterX - 10, 16, 34), target: toWorld(stationCenterX, 1, 0) };
    }
    if (mode === "PASSENGER") {
      return {
        position: toWorld(firstModuleX + 2, 1.7, -PLATFORM_HALF_LENGTH * 0.4),
        target: toWorld(firstModuleX + 2, 1.7, -PLATFORM_HALF_LENGTH * 0.4 + 1),
      };
    }
    // OVERVIEW, and FOLLOW while no train is actually visible to track yet. Kept well under
    // `TUNNEL_HEIGHT` underground so the establishing shot never ends up above the tunnel ceiling.
    return underground
      ? { position: toWorld(stationCenterX + 8, Math.min(7.5, TUNNEL_HEIGHT - 2), 26), target: toWorld(stationCenterX, 2.5, 0) }
      : { position: toWorld(stationCenterX + 18, 28, 54), target: toWorld(stationCenterX, 2, 0) };
  }, [mode, stationCenterX, firstModuleX, underground, layout.orientationRadians]);

  // React's own "adjust state during render" pattern (not a ref, not an effect — see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders):
  // applies the new framing's camera position exactly once per mode/reset/tracking-state change,
  // synchronously before `OrbitControls` (a child) constructs, and never on a re-render from live
  // train data alone. Skipped when we're *entering* real train-tracking — letting the follow lerp
  // pull the camera in from wherever OrbitControls left it reads better than a hard snap.
  const framingKey = `${mode}-${resetToken}-${isTrackingTrain ? "tracking" : "idle"}`;
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  if (appliedKey !== framingKey) {
    setAppliedKey(framingKey);
    if (!isTrackingTrain) camera.position.set(...framing.position);
  }

  useFrame(() => {
    if (!isTrackingTrain || !followTarget) return;
    const platform = layout.platforms.find((p) => p.lineCode === followTarget.lineCode);
    if (!platform) return;

    const pose = trainPose3D(platform, followTarget.direction, followTarget.phase, followTarget.localProgress);
    const behindZ = followTarget.direction === "OUTBOUND" ? -13 : 13;
    const [desiredX, desiredZ] = rotateY(pose.x + 4, pose.z + behindZ, layout.orientationRadians);
    const [lookX, lookZ] = rotateY(pose.x, pose.z, layout.orientationRadians);
    const desired = new THREE.Vector3(desiredX, 6.5, desiredZ);
    camera.position.lerp(desired, CAMERA_FOLLOW_LERP);
    camera.lookAt(lookX, 1.6, lookZ);
  });

  if (isTrackingTrain) return null;

  return (
    <OrbitControls
      key={framingKey}
      target={framing.target}
      enablePan={mode === "FREE"}
      enableZoom={mode !== "PASSENGER"}
      minDistance={mode === "PASSENGER" ? 0.5 : 8}
      maxDistance={
        mode === "PASSENGER" ? 0.5 : mode === "FREE" ? (underground ? 42 : 160) : underground ? 34 : 90
      }
      minPolarAngle={underground ? Math.PI / 6 : 0}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

function pickFollowTrain(trains: readonly TrainVisual3D[]): TrainVisual3D | null {
  for (const phase of FOLLOW_PRIORITY) {
    const match = trains.find((t) => t.phase === phase);
    if (match) return match;
  }
  return null;
}
