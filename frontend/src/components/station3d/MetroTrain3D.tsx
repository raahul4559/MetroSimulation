"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlatformLayout3D, TrainVisual3D } from "@/domain/station3d";
import { trainPose3D } from "@/lib/station3d/position";
import { TRAIN_CARS, TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH } from "@/lib/station3d/constants";

interface MetroTrain3DProps {
  visual: TrainVisual3D;
  platform: Pick<PlatformLayout3D, "moduleIndex">;
  selected: boolean;
  onSelect: () => void;
}

const CAR_GAP = 0.3;
const DOOR_OPEN_OFFSET = 0.9;
/** How fast the rendered (visual) position/door chases its target each frame — a fixed fraction of
 * the remaining distance, not a full snap. This is what makes motion look continuous even though
 * the authoritative backend state only updates roughly once a second; it never runs ahead of or
 * independently from that backend state, only smooths the visible gap between two real samples. */
const POSITION_LERP = 0.12;
const DOOR_LERP = 0.15;

const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#e6e8eb", roughness: 0.45, metalness: 0.35 });

const stripeMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
function stripeMaterial(colorHex: string): THREE.MeshStandardMaterial {
  let material = stripeMaterialCache.get(colorHex);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, emissive: colorHex, emissiveIntensity: 0.1 });
    stripeMaterialCache.set(colorHex, material);
  }
  return material;
}

const doorMaterial = new THREE.MeshStandardMaterial({ color: "#20242c", roughness: 0.4, metalness: 0.5 });
const glassMaterial = new THREE.MeshStandardMaterial({ color: "#8fb7d9", roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.55 });

/**
 * The reusable metro train mesh — one instance per `TrainVisual3D`, and the ONLY thing in this
 * feature that turns simulation state into a moving object. It reads its target pose from
 * `trainPose3D` every frame and eases its rendered transform toward it; it never advances phase,
 * progress, or door state on its own clock. The same train shown here is the same `TrainState` id
 * driving its diamond marker on the 2D map — just a different renderer for the identical data.
 */
export function MetroTrain3D({ visual, platform, selected, onSelect }: MetroTrain3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const doorProgressRef = useRef(0);
  const initializedRef = useRef(false);

  const targetPose = trainPose3D(platform, visual.direction, visual.phase, visual.localProgress);
  const doorsOpenTarget = visual.phase === "BOARDING" ? 1 : 0;

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    if (!initializedRef.current) {
      group.position.set(targetPose.x, targetPose.y, targetPose.z);
      group.rotation.y = targetPose.facing;
      initializedRef.current = true;
    } else {
      group.position.x += (targetPose.x - group.position.x) * POSITION_LERP;
      group.position.z += (targetPose.z - group.position.z) * POSITION_LERP;
      group.position.y = targetPose.y;
      group.rotation.y = targetPose.facing;
    }

    doorProgressRef.current += (doorsOpenTarget - doorProgressRef.current) * DOOR_LERP;
    const doors = (group.userData.doors ?? []) as THREE.Mesh[];
    for (const door of doors) {
      // The platform-facing side is always local X = -1 in this model's own unrotated frame: the
      // train's world-facing rotation (0 or PI, from direction) and which of the two parallel
      // tracks that direction runs on both flip together, so the two effects cancel out — provably
      // true for every station/direction given how trainPose3D ties track offset to forwardSign.
      const opens = door.userData.facingSign === -1;
      door.position.x = (door.userData.baseX as number) + (opens ? doorProgressRef.current * DOOR_OPEN_OFFSET * -1 : 0);
    }
  });

  const totalLength = TRAIN_CARS * TRAIN_CAR_LENGTH + (TRAIN_CARS - 1) * CAR_GAP;
  const carOffsets = useMemo(
    () => Array.from({ length: TRAIN_CARS }, (_, i) => -totalLength / 2 + TRAIN_CAR_LENGTH / 2 + i * (TRAIN_CAR_LENGTH + CAR_GAP)),
    [totalLength]
  );

  return (
    <group
      ref={(g) => {
        groupRef.current = g;
        if (g) g.userData.doors = g.userData.doors ?? [];
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[TRAIN_WIDTH * 0.9, TRAIN_WIDTH * 0.9 + 0.15, 32]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      )}

      {carOffsets.map((z, carIndex) => (
        <group key={carIndex} position={[0, TRAIN_HEIGHT / 2, z]}>
          <mesh material={bodyMaterial} castShadow>
            <boxGeometry args={[TRAIN_WIDTH, TRAIN_HEIGHT, TRAIN_CAR_LENGTH]} />
          </mesh>
          <mesh position={[0, 0.15, 0]} material={stripeMaterial(visual.colorHex)}>
            <boxGeometry args={[TRAIN_WIDTH + 0.02, 0.4, TRAIN_CAR_LENGTH - 0.1]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[(side * TRAIN_WIDTH) / 2 + 0.001, 0.55, 0]} rotation={[0, 0, 0]} material={glassMaterial}>
              <boxGeometry args={[0.02, TRAIN_HEIGHT * 0.4, TRAIN_CAR_LENGTH - 1.2]} />
            </mesh>
          ))}
          {[-1, 1].map((facingSign) => (
            <mesh
              key={facingSign}
              ref={(m) => {
                if (!m || !groupRef.current) return;
                m.userData.baseX = (facingSign * TRAIN_WIDTH) / 2 + facingSign * 0.02;
                m.userData.facingSign = facingSign;
                m.position.x = m.userData.baseX;
                const doors = groupRef.current.userData.doors as THREE.Mesh[];
                if (!doors.includes(m)) doors.push(m);
              }}
              position={[(facingSign * TRAIN_WIDTH) / 2 + facingSign * 0.02, -0.35, 0]}
              material={doorMaterial}
            >
              <boxGeometry args={[0.04, TRAIN_HEIGHT * 0.75, 1.3]} />
            </mesh>
          ))}
        </group>
      ))}

      <mesh position={[0, TRAIN_HEIGHT * 0.55, totalLength / 2 - 0.05]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#fff7d6" emissive="#ffe58a" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}
