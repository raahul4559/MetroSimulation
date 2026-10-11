"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlatformLayout3D, TrainVisual3D } from "@/domain/station3d";
import { trainPose3D } from "@/lib/station3d/position";
import { resolveTrainPhase } from "@/lib/station3d/trainVisual";
import { useOptionalTrainMotion } from "@/providers/SimulationProvider";
import { TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_LENGTH, TRAIN_WIDTH } from "@/lib/station3d/constants";
import { trainCarCenters } from "@/lib/station3d/trainLayout";

interface MetroTrain3DProps {
  visual: TrainVisual3D;
  stationId: number;
  platform: Pick<PlatformLayout3D, "moduleIndex">;
  selected: boolean;
  onSelect: () => void;
}

const DOOR_OPEN_OFFSET = 0.9;
/** Door panels' opening time constant, in seconds. Doors are a mechanism animating toward the
 * state the canonical phase sets (BOARDING = open) — not a position, so not the motion store's job. */
const DOOR_TIME_CONSTANT_S = 0.35;

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
 * The reusable metro train mesh — one instance per `TrainVisual3D`. It has no animation of its
 * own: every display frame it asks the shared motion store (`lib/realtime/trainMotion`) where this
 * train is — the exact sample the 2D map marker is drawn from at that moment — resolves that onto
 * this station's scene (`resolveTrainPhase`) and places the mesh there (`trainPose3D`). Both are
 * pure, so the 3D train and the 2D marker cannot drift apart. It hides itself while the sampled
 * position is out on the line beyond the scene's visible window.
 *
 * Outside the live provider (no motion store) it is placed at the canonical visual's pose as-is.
 */
export function MetroTrain3D({ visual, stationId, platform, selected, onSelect }: MetroTrain3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const doorProgressRef = useRef(0);
  const motion = useOptionalTrainMotion();

  useFrame((_, deltaSeconds) => {
    const group = groupRef.current;
    if (!group) return;

    let phase = visual.phase;
    let localProgress = visual.localProgress;
    let direction = visual.direction;
    if (motion) {
      const sampled = motion.sample(visual.trainId, performance.now());
      const resolved = sampled ? resolveTrainPhase(sampled, stationId) : null;
      if (!sampled || !resolved) {
        group.visible = false;
        return;
      }
      phase = resolved.phase;
      localProgress = resolved.localProgress;
      direction = sampled.direction;
    }
    group.visible = true;

    const pose = trainPose3D(platform, direction, phase, localProgress);
    group.position.set(pose.x, pose.y, pose.z);
    group.rotation.y = pose.facing;

    const doorsOpenTarget = phase === "BOARDING" ? 1 : 0;
    const doorStep = 1 - Math.exp(-Math.min(deltaSeconds, 0.1) / DOOR_TIME_CONSTANT_S);
    doorProgressRef.current += (doorsOpenTarget - doorProgressRef.current) * doorStep;
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

  const totalLength = TRAIN_LENGTH;
  const carOffsets = useMemo(() => trainCarCenters(), []);

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
