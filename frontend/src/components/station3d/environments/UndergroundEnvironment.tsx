import { useMemo } from "react";
import * as THREE from "three";
import { CANOPY_HEIGHT, ENVIRONMENT_LENGTH, PLATFORM_HEIGHT, TUNNEL_HEIGHT, TUNNEL_WALL_MARGIN } from "@/lib/station3d/constants";

interface UndergroundEnvironmentProps {
  /** Local-X span of every platform module's outer edge, before this environment's own margin —
   * see `StationModel`'s footprint calculation, shared with `ElevatedEnvironment`/`AtGradeEnvironment`. */
  minX: number;
  maxX: number;
}

const wallMaterial = new THREE.MeshStandardMaterial({ color: "#171b24", roughness: 0.95, side: THREE.DoubleSide });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: "#10131a", roughness: 1, side: THREE.DoubleSide });
const lightStripMaterial = new THREE.MeshStandardMaterial({
  color: "#dce8ff",
  emissive: "#9fc2ff",
  emissiveIntensity: 1.4,
});

const LIGHT_SPACING = 9;

/**
 * Level 3's UNDERGROUND shell: a bored tunnel — walls and ceiling wrapping every platform module,
 * lit by recessed strips rather than daylight, no sky/exterior of any kind. Deliberately doesn't
 * model the tunnel bore as circular (a box is a fair schematic simplification, same spirit as the
 * platform/track geometry) — the point is "enclosed underground volume," not a TBM cross-section.
 */
export function UndergroundEnvironment({ minX, maxX }: UndergroundEnvironmentProps) {
  const centerX = (minX + maxX) / 2;
  const width = maxX - minX + TUNNEL_WALL_MARGIN * 2;
  const length = ENVIRONMENT_LENGTH;

  const lightPositions = useMemo(() => {
    const count = Math.max(2, Math.floor(length / LIGHT_SPACING));
    return Array.from({ length: count }, (_, i) => -length / 2 + (i + 0.5) * (length / count));
  }, [length]);

  return (
    <group position={[centerX, 0, 0]}>
      <mesh position={[0, TUNNEL_HEIGHT, 0]} material={ceilingMaterial} receiveShadow>
        <boxGeometry args={[width, 0.4, length]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2, TUNNEL_HEIGHT / 2, 0]} material={wallMaterial} receiveShadow>
          <boxGeometry args={[0.4, TUNNEL_HEIGHT, length]} />
        </mesh>
      ))}

      {lightPositions.map((z) => (
        <mesh key={z} position={[0, TUNNEL_HEIGHT - 0.35, z]} material={lightStripMaterial}>
          <boxGeometry args={[width * 0.5, 0.08, 1.4]} />
        </mesh>
      ))}

      <pointLight position={[0, PLATFORM_HEIGHT + CANOPY_HEIGHT * 0.6, 0]} intensity={0.4} distance={40} color="#bcd4ff" />
    </group>
  );
}
