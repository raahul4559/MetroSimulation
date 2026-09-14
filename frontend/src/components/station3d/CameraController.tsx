"use client";

import { useEffect, useMemo, useRef } from "react";
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

/**
 * Owns the camera for all four modes. OVERVIEW/FREE/PASSENGER hand the camera to drei's
 * `OrbitControls` (with different constraints); FOLLOW disables it and drives the camera itself
 * every frame from the tracked train's real pose (see `trainPose3D`) — the two never fight over the
 * same camera in the same mode.
 */
export function CameraController({ mode, layout, trains, resetToken }: CameraControllerProps) {
  const { camera } = useThree();
  // three-stdlib's OrbitControls type varies by version; the ref is only ever used for
  // `.target`/`.update()`, which is stable across the versions drei supports.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);

  const stationCenterX = ((layout.platforms.length - 1) * MODULE_SPACING) / 2;
  const firstModuleX = (layout.platforms[0]?.moduleIndex ?? 0) * MODULE_SPACING;

  useEffect(() => {
    if (mode === "OVERVIEW") {
      camera.position.set(stationCenterX + 14, 24, 44);
      orbitRef.current?.target.set(stationCenterX, 2, 0);
      orbitRef.current?.update();
    } else if (mode === "FREE") {
      camera.position.set(stationCenterX - 10, 16, 34);
      orbitRef.current?.target.set(stationCenterX, 1, 0);
      orbitRef.current?.update();
    } else if (mode === "PASSENGER") {
      const eye = new THREE.Vector3(firstModuleX + 2, 1.7, -PLATFORM_HALF_LENGTH * 0.4);
      camera.position.copy(eye);
      const target = eye.clone().add(new THREE.Vector3(0, 0, 1));
      orbitRef.current?.target.copy(target);
      orbitRef.current?.update();
    }
    // Re-run whenever the mode OR the explicit reset button changes — not on every layout re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resetToken, stationCenterX, firstModuleX]);

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
      ref={orbitRef}
      enablePan={mode === "FREE"}
      enableZoom={mode !== "PASSENGER"}
      minDistance={mode === "PASSENGER" ? 1 : 8}
      maxDistance={mode === "PASSENGER" ? 1 : mode === "FREE" ? 160 : 90}
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
