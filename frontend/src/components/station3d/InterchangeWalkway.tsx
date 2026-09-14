import * as THREE from "three";
import { PLATFORM_HALF_LENGTH, PLATFORM_HEIGHT, PLATFORM_WIDTH } from "@/lib/station3d/constants";

interface InterchangeWalkwayProps {
  /** Local-X centre of every platform module this walkway must span — same values as
   * `PlatformLayout3D.moduleIndex * MODULE_SPACING`, passed straight from `StationModel`. */
  moduleXs: readonly number[];
}

const deckMaterial = new THREE.MeshStandardMaterial({ color: "#7d828c", roughness: 0.7 });
const railMaterial = new THREE.MeshStandardMaterial({ color: "#3d434c", metalness: 0.4, roughness: 0.5 });

const WALKWAY_Z = PLATFORM_HALF_LENGTH + 3.5;
const WALKWAY_WIDTH = 3.2;
const RAIL_HEIGHT = 1.0;

/**
 * The physical transfer path an interchange needs between its platform modules — a concourse-level
 * deck spanning every line's platform at the station's far end, past the canopy. This is purely the
 * built structure a passenger walks across; the passengers actually shown walking across it are the
 * same shared roster every other platform reads (`status === "TRANSFER"`, see
 * `resolveStationPassengers3D`) — no separate transfer logic lives here. Only ever mounted when
 * `StationConfig.isInterchange` is true and there's more than one platform module to connect.
 */
export function InterchangeWalkway({ moduleXs }: InterchangeWalkwayProps) {
  if (moduleXs.length < 2) return null;
  const minX = Math.min(...moduleXs) - PLATFORM_WIDTH / 2;
  const maxX = Math.max(...moduleXs) + PLATFORM_WIDTH / 2;
  const width = maxX - minX;
  const centerX = (minX + maxX) / 2;

  return (
    <group position={[centerX, PLATFORM_HEIGHT, WALKWAY_Z]}>
      <mesh position={[0, 0.05, 0]} material={deckMaterial} receiveShadow castShadow>
        <boxGeometry args={[width, 0.1, WALKWAY_WIDTH]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, RAIL_HEIGHT / 2 + 0.1, (side * WALKWAY_WIDTH) / 2]} material={railMaterial}>
          <boxGeometry args={[width, 0.05, 0.05]} />
        </mesh>
      ))}
      {moduleXs.map((x) => (
        <mesh key={x} position={[x - centerX, -0.6, 0]} material={deckMaterial}>
          <boxGeometry args={[PLATFORM_WIDTH * 0.7, 1.2, WALKWAY_WIDTH * 0.9]} />
        </mesh>
      ))}
    </group>
  );
}
