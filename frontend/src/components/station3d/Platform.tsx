import { useMemo } from "react";
import * as THREE from "three";
import {
  CANOPY_HEIGHT,
  PILLAR_SPACING,
  PLATFORM_HALF_LENGTH,
  PLATFORM_HEIGHT,
  PLATFORM_WIDTH,
} from "@/lib/station3d/constants";

interface PlatformProps {
  /** Local X centre of this platform module (see `layout.ts` — `moduleIndex * MODULE_SPACING`). */
  x: number;
  colorHex: string;
  /** TERMINAL stations get a slightly grander canopy/end-wall; INTERCHANGE gets a busier pillar
   * cadence; REGULAR is the plain default — a small, honest nod to station type without inventing
   * per-station detail. */
  stationType: "REGULAR" | "INTERCHANGE" | "TERMINAL";
}

const deckMaterial = new THREE.MeshStandardMaterial({ color: "#8f8a80", roughness: 0.85 });
const edgeMaterial = new THREE.MeshStandardMaterial({ color: "#e8b923", roughness: 0.6, emissive: "#3a2c00", emissiveIntensity: 0.15 });
const pillarMaterial = new THREE.MeshStandardMaterial({ color: "#5b5d63", roughness: 0.7, metalness: 0.2 });
const canopyMaterial = new THREE.MeshStandardMaterial({ color: "#b3bcc9", roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });

/**
 * One island platform: a raised deck with a yellow safety edge on both sides (a track either side,
 * per the station's layout — see `StationModel`), pillars along its length, and a flat canopy roof.
 * Priority follows the spec's own ordering (layout → platform → track → …) — this is the first
 * "real structure" piece after the bare track.
 */
export function Platform({ x, colorHex, stationType }: PlatformProps) {
  const length = PLATFORM_HALF_LENGTH * 2;
  const pillarCount = Math.max(2, Math.floor(length / PILLAR_SPACING));
  const pillarPositions = useMemo(
    () => Array.from({ length: pillarCount }, (_, i) => -PLATFORM_HALF_LENGTH + (i + 0.5) * (length / pillarCount)),
    [pillarCount, length]
  );
  const grand = stationType === "TERMINAL";

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, PLATFORM_HEIGHT / 2, 0]} material={deckMaterial} receiveShadow castShadow>
        <boxGeometry args={[PLATFORM_WIDTH, PLATFORM_HEIGHT, length]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * PLATFORM_WIDTH) / 2, PLATFORM_HEIGHT - 0.05, 0]} material={edgeMaterial}>
          <boxGeometry args={[0.15, 0.1, length]} />
        </mesh>
      ))}

      {pillarPositions.map((z, i) => (
        <mesh key={i} position={[0, PLATFORM_HEIGHT + CANOPY_HEIGHT / 2, z]} material={pillarMaterial} castShadow>
          <cylinderGeometry args={[0.22, 0.22, CANOPY_HEIGHT, 10]} />
        </mesh>
      ))}

      <mesh position={[0, PLATFORM_HEIGHT + CANOPY_HEIGHT, 0]} material={canopyMaterial} receiveShadow>
        <boxGeometry args={[PLATFORM_WIDTH + (grand ? 2.5 : 1.5), 0.25, length + (grand ? 4 : 0)]} />
      </mesh>

      {grand && (
        <mesh position={[0, PLATFORM_HEIGHT + CANOPY_HEIGHT / 2, PLATFORM_HALF_LENGTH + 1]} material={pillarMaterial}>
          <boxGeometry args={[PLATFORM_WIDTH + 2, CANOPY_HEIGHT, 0.4]} />
        </mesh>
      )}

      <mesh position={[0, PLATFORM_HEIGHT + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, length * 0.94]} />
        <meshStandardMaterial color={colorHex} roughness={0.9} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
