import { useMemo } from "react";
import * as THREE from "three";
import {
  ENVIRONMENT_LENGTH,
  PLATFORM_WIDTH,
  STREET_LEVEL_DROP,
  VIADUCT_COLUMN_RADIUS,
  VIADUCT_COLUMN_SPACING,
  VIADUCT_DECK_THICKNESS,
} from "@/lib/station3d/constants";

interface ElevatedEnvironmentProps {
  minX: number;
  maxX: number;
}

const deckMaterial = new THREE.MeshStandardMaterial({ color: "#6b6f76", roughness: 0.85 });
const columnMaterial = new THREE.MeshStandardMaterial({ color: "#5a5e66", roughness: 0.8 });
const groundMaterial = new THREE.MeshStandardMaterial({ color: "#4f5a46", roughness: 1 });
const roadMaterial = new THREE.MeshStandardMaterial({ color: "#33363c", roughness: 0.95 });
const roadMarkingMaterial = new THREE.MeshStandardMaterial({ color: "#d8cf9a", roughness: 0.8 });
const buildingMaterials = ["#8a7c66", "#7c8a92", "#9c8f7a", "#6f7a86"].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
);

/** A handful of simple context buildings scattered along the street below — just enough to read as
 * "a real street," never a city block; deterministic (station-shape-independent) so this doesn't
 * flicker between renders. */
interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  materialIndex: number;
}

/**
 * Level 3's ELEVATED shell: the viaduct deck and its columns down to street level, plus just
 * enough street-level context (a road, a few buildings) that the station reads as sitting above a
 * real street rather than floating in a void. The train's own track/platform sit on top of this
 * deck already (see `Platform`/`Track`) — this component only adds what's *underneath* them.
 */
export function ElevatedEnvironment({ minX, maxX }: ElevatedEnvironmentProps) {
  const centerX = (minX + maxX) / 2;
  const deckWidth = maxX - minX + PLATFORM_WIDTH + 4;
  const length = ENVIRONMENT_LENGTH;
  const deckTop = -0.2;
  const deckY = deckTop - VIADUCT_DECK_THICKNESS / 2;
  const groundY = -STREET_LEVEL_DROP;

  const columnZs = useMemo(() => {
    const count = Math.max(2, Math.floor(length / VIADUCT_COLUMN_SPACING));
    return Array.from({ length: count }, (_, i) => -length / 2 + (i + 0.5) * (length / count));
  }, [length]);

  const buildings = useMemo<BuildingSpec[]>(() => {
    const specs: BuildingSpec[] = [];
    const sides = [-1, 1];
    let seed = 0;
    for (const side of sides) {
      for (let i = 0; i < 5; i++) {
        seed += 1;
        const jitter = pseudoRandom(seed);
        specs.push({
          x: side * (deckWidth / 2 + 14 + jitter * 10),
          z: -length / 2 + (i + 0.5) * (length / 5) + (jitter - 0.5) * 8,
          width: 8 + jitter * 10,
          depth: 8 + (1 - jitter) * 8,
          height: 6 + jitter * 16,
          materialIndex: Math.floor(jitter * buildingMaterials.length) % buildingMaterials.length,
        });
      }
    }
    return specs;
  }, [deckWidth, length]);

  return (
    <group position={[centerX, 0, 0]}>
      <mesh position={[0, deckY, 0]} material={deckMaterial} castShadow receiveShadow>
        <boxGeometry args={[deckWidth, VIADUCT_DECK_THICKNESS, length]} />
      </mesh>

      {columnZs.map((z) => (
        <mesh key={z} position={[0, (groundY + deckY - VIADUCT_DECK_THICKNESS / 2) / 2, z]} material={columnMaterial} castShadow>
          <cylinderGeometry args={[VIADUCT_COLUMN_RADIUS, VIADUCT_COLUMN_RADIUS * 1.15, deckY - VIADUCT_DECK_THICKNESS / 2 - groundY, 12]} />
        </mesh>
      ))}

      <mesh position={[0, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]} material={groundMaterial} receiveShadow>
        <planeGeometry args={[deckWidth + 120, length]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (deckWidth / 2 + 9), groundY + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={roadMaterial} receiveShadow>
            <planeGeometry args={[7, length]} />
          </mesh>
          <mesh position={[side * (deckWidth / 2 + 9), groundY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={roadMarkingMaterial}>
            <planeGeometry args={[0.2, length]} />
          </mesh>
        </group>
      ))}

      {buildings.map((b, i) => (
        <mesh
          key={i}
          position={[b.x, groundY + b.height / 2, b.z]}
          material={buildingMaterials[b.materialIndex % buildingMaterials.length]!}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[b.width, b.height, b.depth]} />
        </mesh>
      ))}
    </group>
  );
}

/** Deterministic 0..1 pseudo-random value, seeded by an integer — same trick as the passenger
 * layer's `scatterZ`, so the street context doesn't reshuffle every render. */
function pseudoRandom(seed: number): number {
  const t = Math.sin(seed * 12.9898) * 43758.5453;
  return t - Math.floor(t);
}
