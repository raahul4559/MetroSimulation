import { useMemo } from "react";
import * as THREE from "three";
import { AT_GRADE_FENCE_HEIGHT, AT_GRADE_FENCE_POST_SPACING, ENVIRONMENT_LENGTH, PLATFORM_WIDTH } from "@/lib/station3d/constants";

interface AtGradeEnvironmentProps {
  minX: number;
  maxX: number;
}

const groundMaterial = new THREE.MeshStandardMaterial({ color: "#5a6b4a", roughness: 1 });
const pathMaterial = new THREE.MeshStandardMaterial({ color: "#7d7362", roughness: 0.9 });
const fenceMaterial = new THREE.MeshStandardMaterial({ color: "#3d434c", metalness: 0.3, roughness: 0.6 });
const roadMaterial = new THREE.MeshStandardMaterial({ color: "#33363c", roughness: 0.95 });

/**
 * Level 3's AT_GRADE shell: the station sits directly on the ground, so there's no viaduct and no
 * tunnel — just a ground plane, a paved access path either side of the platform, a boundary fence
 * along the open edges, and a nearby road for context. Namma Metro's current operational network
 * has no at-grade station (see `stationConfigs.ts`'s coverage note); this exists so one can be
 * added with a config entry alone, no new rendering code.
 */
export function AtGradeEnvironment({ minX, maxX }: AtGradeEnvironmentProps) {
  const centerX = (minX + maxX) / 2;
  const width = maxX - minX + PLATFORM_WIDTH + 4;
  const length = ENVIRONMENT_LENGTH;

  const fencePositions = useMemo(() => {
    const count = Math.max(2, Math.floor(length / AT_GRADE_FENCE_POST_SPACING));
    return Array.from({ length: count }, (_, i) => -length / 2 + (i + 0.5) * (length / count));
  }, [length]);

  return (
    <group position={[centerX, 0, 0]}>
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={groundMaterial} receiveShadow>
        <planeGeometry args={[width + 100, length]} />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 3), -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pathMaterial} receiveShadow>
          <planeGeometry args={[3, length]} />
        </mesh>
      ))}

      {[-1, 1].map((side) =>
        fencePositions.map((z) => (
          <mesh key={`${side}-${z}`} position={[side * (width / 2 + 5), AT_GRADE_FENCE_HEIGHT / 2, z]} material={fenceMaterial}>
            <boxGeometry args={[0.12, AT_GRADE_FENCE_HEIGHT, 0.12]} />
          </mesh>
        ))
      )}
      {[-1, 1].map((side) => (
        <mesh key={`rail-${side}`} position={[side * (width / 2 + 5), AT_GRADE_FENCE_HEIGHT - 0.1, 0]} material={fenceMaterial}>
          <boxGeometry args={[0.06, 0.06, length]} />
        </mesh>
      ))}

      <mesh position={[0, -0.02, -length / 2 - 8]} rotation={[-Math.PI / 2, 0, 0]} material={roadMaterial} receiveShadow>
        <planeGeometry args={[width + 20, 8]} />
      </mesh>
    </group>
  );
}
