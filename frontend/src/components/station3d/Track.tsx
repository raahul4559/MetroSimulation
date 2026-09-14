import { useMemo } from "react";
import * as THREE from "three";
import {
  APPROACH_LENGTH,
  DEPART_LENGTH,
  PLATFORM_HALF_LENGTH,
  RAIL_GAUGE,
} from "@/lib/station3d/constants";

interface TrackProps {
  /** Local X offset (lateral) of this track's centreline — see `position.ts#trainPose3D`. */
  x: number;
  hasApproach: boolean;
  hasDepart: boolean;
}

const RAIL_HEIGHT = 0.14;
const RAIL_WIDTH = 0.1;
const SLEEPER_SPACING = 2.2;
const SLEEPER_LENGTH = RAIL_GAUGE + 0.9;
const SLEEPER_WIDTH = 0.32;
const SLEEPER_HEIGHT = 0.12;

const railMaterial = new THREE.MeshStandardMaterial({ color: "#8a8f98", metalness: 0.7, roughness: 0.4 });
const sleeperMaterial = new THREE.MeshStandardMaterial({ color: "#3f3a34", roughness: 0.9 });
const ballastMaterial = new THREE.MeshStandardMaterial({ color: "#4b4640", roughness: 1 });

/**
 * A single track: two rails + sleepers + a ballast bed, running the full visible length (approach +
 * platform + departure, whichever ends this direction actually has — a terminus's outer end has
 * neither). Instanced sleepers so a ~50-unit track isn't one draw call per tie.
 */
export function Track({ x, hasApproach, hasDepart }: TrackProps) {
  const startZ = hasApproach ? -(PLATFORM_HALF_LENGTH + APPROACH_LENGTH) : -PLATFORM_HALF_LENGTH;
  const endZ = hasDepart ? PLATFORM_HALF_LENGTH + DEPART_LENGTH : PLATFORM_HALF_LENGTH;
  const length = endZ - startZ;
  const centerZ = (startZ + endZ) / 2;

  const sleeperTransforms = useMemo(() => {
    const count = Math.max(1, Math.floor(length / SLEEPER_SPACING));
    return Array.from({ length: count }, (_, i) => startZ + i * SLEEPER_SPACING + SLEEPER_SPACING / 2);
  }, [length, startZ]);

  return (
    <group position={[x, 0, centerZ]}>
      <mesh position={[0, -0.1, 0]} material={ballastMaterial} receiveShadow>
        <boxGeometry args={[SLEEPER_LENGTH + 0.6, 0.2, length]} />
      </mesh>
      <Instances geometryArgs={[SLEEPER_LENGTH, SLEEPER_HEIGHT, SLEEPER_WIDTH]} material={sleeperMaterial} positions={sleeperTransforms} />
      <mesh position={[-RAIL_GAUGE / 2, RAIL_HEIGHT / 2, 0]} material={railMaterial} castShadow>
        <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, length]} />
      </mesh>
      <mesh position={[RAIL_GAUGE / 2, RAIL_HEIGHT / 2, 0]} material={railMaterial} castShadow>
        <boxGeometry args={[RAIL_WIDTH, RAIL_HEIGHT, length]} />
      </mesh>
    </group>
  );
}

/** Instanced sleepers along the track's local Z — avoids one mesh per tie on a long track. */
function Instances({
  geometryArgs,
  material,
  positions,
}: {
  geometryArgs: [number, number, number];
  material: THREE.Material;
  positions: readonly number[];
}) {
  const geometry = useMemo(() => new THREE.BoxGeometry(...geometryArgs), [geometryArgs]);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geometry, material, positions.length);
    const dummy = new THREE.Object3D();
    positions.forEach((z, i) => {
      dummy.position.set(0, 0, z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [geometry, material, positions]);

  return <primitive object={mesh} receiveShadow />;
}
