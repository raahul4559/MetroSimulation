"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlatformLayout3D, TrainVisual3D } from "@/domain/station3d";
import type { Passenger } from "@/domain/trainsim";
import { resolveStationPassengers3D } from "@/lib/station3d/passengerVisual";
import { PLATFORM_HALF_LENGTH, PLATFORM_HEIGHT } from "@/lib/station3d/constants";

interface Passengers3DProps {
  /** The full live roster — not pre-filtered to this station — because resolving what happened to a
   * passenger who just left this platform's `resolved` set (boarded vs. transferred vs. completed;
   * see the reconciliation effect below) requires looking them up by id regardless of where they are
   * now. */
  passengers: readonly Passenger[];
  stationId: number;
  platform: PlatformLayout3D;
  /** This platform's own line's trains only (already filtered by the caller, same as `MetroTrain3D`'s
   * per-platform grouping in `StationModel`). */
  trainsHere: readonly TrainVisual3D[];
}

/** Rendered-crowd cap per platform — real waiting/boarding/alighting counts can run well past this;
 * capping keeps this instanced draw call cheap regardless of demand, prioritizing whichever
 * passengers are mid-story (see `rank`) over the merely-waiting when it's exceeded. */
const MAX_INSTANCES = 48;
const WALK_SPEED = 1.6;
const DOOR_SPEED = 3;
const EXIT_SPEED = 2.2;
const BOARD_FADE_SECONDS = 0.6;
const EXIT_FADE_SECONDS = 1;
const MAX_LIVE_SECONDS = 6;
/** Where a newly-WAITING passenger walks in from, and where a COMPLETED one walks out to — the
 * platform's concourse-side end, just past the canopy. Purely a staging point for this decorative
 * walk-on/walk-off; it isn't itself part of the station layout. */
const CONCOURSE_Z = PLATFORM_HALF_LENGTH + 4;

const BODY_RADIUS = 0.22;
const BODY_LENGTH = 0.7;
const BODY_HEIGHT = BODY_LENGTH + BODY_RADIUS * 2;
const HEAD_RADIUS = 0.16;
const FOOT_Y = PLATFORM_HEIGHT;
const BODY_CENTER_Y = FOOT_Y + BODY_HEIGHT / 2;
const HEAD_CENTER_Y = FOOT_Y + BODY_HEIGHT + HEAD_RADIUS * 0.7;

type LocalPhase = "WAITING" | "BOARDING" | "ALIGHTING" | "BOARDED" | "EXITING";

interface PassengerAnim {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  phase: LocalPhase;
  scale: number;
  timer: number;
  colorIndex: number;
}

const PALETTE = ["#f2b880", "#c98a58", "#8a5a3c", "#d8c39a", "#6b7280", "#9aa5b1", "#4b5563", "#e0b0a0"];

const bodyGeometry = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 2, 6);
const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS, 8, 6);
const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 });
const headMaterial = new THREE.MeshStandardMaterial({ color: "#e8c9a0", roughness: 0.7 });
const tmpColor = new THREE.Color();
const tmpObject = new THREE.Object3D();

/**
 * One platform module's crowd — waiting figures on the platform, walking to/from open train doors
 * when boarding or alighting, fading out once they've boarded or genuinely left the simulation
 * (`COMPLETED`). Every target position comes from `resolveStationPassengers3D` (real passenger
 * fields only); this component's only own state is the walk animation smoothing one real sample to
 * the next, the same role `MetroTrain3D` plays for train position/doors.
 */
export function Passengers3D({ passengers, stationId, platform, trainsHere }: Passengers3DProps) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const animsRef = useRef<Map<number, PassengerAnim>>(new Map());

  useEffect(() => {
    const resolved = resolveStationPassengers3D(passengers, stationId, platform, trainsHere);
    const anims = animsRef.current;
    const resolvedIds = new Set(resolved.map((v) => v.passengerId));

    for (const v of resolved) {
      const existing = anims.get(v.passengerId);
      if (existing) {
        existing.targetX = v.targetX;
        existing.targetZ = v.targetZ;
        existing.phase = v.phase;
        existing.timer = 0;
        continue;
      }
      const spawningIn = v.phase === "WAITING";
      anims.set(v.passengerId, {
        x: spawningIn ? 0 : v.targetX,
        z: spawningIn ? CONCOURSE_Z : v.targetZ,
        targetX: v.targetX,
        targetZ: v.targetZ,
        phase: v.phase,
        scale: 1,
        timer: 0,
        colorIndex: v.passengerId % PALETTE.length,
      });
    }

    for (const [id, anim] of anims) {
      if (resolvedIds.has(id) || anim.phase === "BOARDED" || anim.phase === "EXITING") continue;
      const stillActive = passengers.find((p) => p.id === id);
      if (!stillActive) {
        // Gone from the simulation entirely — their journey completed. Wrap up with a walk to the
        // concourse and a fade; purely cosmetic, the real journey is already over.
        anim.phase = "EXITING";
        anim.targetX = 0;
        anim.targetZ = CONCOURSE_Z;
      } else if (stillActive.status === "ON_TRAIN") {
        anim.phase = "BOARDED";
      } else {
        // No longer this platform's concern (e.g. handed off to a different line's module at an
        // interchange) — no wrap-up animation needed, the other module already has them.
        anims.delete(id);
      }
    }
  }, [passengers, stationId, platform, trainsHere]);

  useFrame((_state, delta) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;

    const anims = animsRef.current;
    const ordered = [...anims.entries()].sort((a, b) => rank(a[1].phase) - rank(b[1].phase));
    let index = 0;

    for (const [id, anim] of ordered) {
      const speed = anim.phase === "WAITING" ? WALK_SPEED : anim.phase === "EXITING" ? EXIT_SPEED : DOOR_SPEED;
      stepToward(anim, speed, delta);

      if (anim.phase === "BOARDED" || anim.phase === "EXITING") {
        anim.timer += delta;
        const reachedExit = anim.phase === "BOARDED" || Math.hypot(anim.x - anim.targetX, anim.z - anim.targetZ) < 0.2;
        if (reachedExit) {
          const fadeDuration = anim.phase === "BOARDED" ? BOARD_FADE_SECONDS : EXIT_FADE_SECONDS;
          anim.scale = Math.max(0, 1 - anim.timer / fadeDuration);
        }
        if (anim.timer > MAX_LIVE_SECONDS || (reachedExit && anim.scale <= 0)) {
          anims.delete(id);
          continue;
        }
      }

      if (index >= MAX_INSTANCES) continue;
      writeInstance(body, head, index, anim);
      index++;
    }

    for (let i = index; i < MAX_INSTANCES; i++) {
      tmpObject.position.set(0, -50, 0);
      tmpObject.scale.setScalar(0);
      tmpObject.updateMatrix();
      body.setMatrixAt(i, tmpObject.matrix);
      head.setMatrixAt(i, tmpObject.matrix);
    }

    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodyRef} args={[bodyGeometry, bodyMaterial, MAX_INSTANCES]} castShadow frustumCulled={false} />
      <instancedMesh ref={headRef} args={[headGeometry, headMaterial, MAX_INSTANCES]} castShadow frustumCulled={false} />
    </>
  );
}

function writeInstance(body: THREE.InstancedMesh, head: THREE.InstancedMesh, index: number, anim: PassengerAnim) {
  tmpObject.position.set(anim.x, BODY_CENTER_Y, anim.z);
  tmpObject.scale.setScalar(anim.scale);
  tmpObject.updateMatrix();
  body.setMatrixAt(index, tmpObject.matrix);
  body.setColorAt(index, tmpColor.set(PALETTE[anim.colorIndex] ?? "#94a3b8"));

  tmpObject.position.set(anim.x, HEAD_CENTER_Y, anim.z);
  tmpObject.updateMatrix();
  head.setMatrixAt(index, tmpObject.matrix);
}

function stepToward(anim: PassengerAnim, speed: number, delta: number) {
  const dx = anim.targetX - anim.x;
  const dz = anim.targetZ - anim.z;
  const dist = Math.hypot(dx, dz);
  const step = speed * delta;
  if (dist <= step || dist === 0) {
    anim.x = anim.targetX;
    anim.z = anim.targetZ;
    return;
  }
  anim.x += (dx / dist) * step;
  anim.z += (dz / dist) * step;
}

function rank(phase: LocalPhase): number {
  switch (phase) {
    case "BOARDING":
    case "ALIGHTING":
      return 0;
    case "EXITING":
    case "BOARDED":
      return 1;
    case "WAITING":
      return 2;
  }
}
