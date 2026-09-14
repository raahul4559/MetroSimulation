"use client";

import { useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { CameraMode3D, StationLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import { trainPose3D } from "@/lib/station3d/position";
import { MODULE_SPACING, PLATFORM_HALF_LENGTH } from "@/lib/station3d/constants";

interface CameraControllerProps {
  mode: CameraMode3D;
  layout: StationLayout3D;
  trains: readonly TrainVisual3D[];
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
 */
export function CameraController({ mode, layout, trains, resetToken }: CameraControllerProps) {
  const { camera } = useThree();

  const stationCenterX = ((layout.platforms.length - 1) * MODULE_SPACING) / 2;
  const firstModuleX = (layout.platforms[0]?.moduleIndex ?? 0) * MODULE_SPACING;

  const framing = useMemo<FramingPreset>(() => {
    if (mode === "FREE") {
      return { position: [stationCenterX - 10, 16, 34], target: [stationCenterX, 1, 0] };
    }
    if (mode === "PASSENGER") {
      return { position: [firstModuleX + 2, 1.7, -PLATFORM_HALF_LENGTH * 0.4], target: [firstModuleX + 2, 1.7, -PLATFORM_HALF_LENGTH * 0.4 + 1] };
    }
    // OVERVIEW and FOLLOW (FOLLOW never renders OrbitControls, but still needs a harmless default).
    return { position: [stationCenterX + 18, 28, 54], target: [stationCenterX, 2, 0] };
  }, [mode, stationCenterX, firstModuleX]);

  // React's own "adjust state during render" pattern (not a ref, not an effect — see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders):
  // applies the new framing's camera position exactly once per mode/reset change, synchronously
  // before `OrbitControls` (a child) constructs, and never on a re-render from live train data.
  const framingKey = `${mode}-${resetToken}`;
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  if (appliedKey !== framingKey) {
    setAppliedKey(framingKey);
    camera.position.set(...framing.position);
  }

  const followTarget = useMemo(() => pickFollowTrain(trains), [trains]);

  useFrame(() => {
    if (mode !== "FOLLOW") return;
    if (!followTarget) return;
    const platform = layout.platforms.find((p) => p.lineCode === followTarget.lineCode);
    if (!platform) return;

    const pose = trainPose3D(platform, followTarget.direction, followTarget.phase, followTarget.localProgress);
    const behindZ = followTarget.direction === "OUTBOUND" ? -13 : 13;
    const desired = new THREE.Vector3(pose.x + 4, 6.5, pose.z + behindZ);
    camera.position.lerp(desired, CAMERA_FOLLOW_LERP);
    camera.lookAt(pose.x, 1.6, pose.z);
  });

  if (mode === "FOLLOW") return null;

  return (
    <OrbitControls
      key={framingKey}
      target={framing.target}
      enablePan={mode === "FREE"}
      enableZoom={mode !== "PASSENGER"}
      minDistance={mode === "PASSENGER" ? 0.5 : 8}
      maxDistance={mode === "PASSENGER" ? 0.5 : mode === "FREE" ? 160 : 90}
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
