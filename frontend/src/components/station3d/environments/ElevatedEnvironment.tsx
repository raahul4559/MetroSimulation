import { useMemo } from "react";
import * as THREE from "three";
import type { ArchitecturalProfile } from "@/domain/stationConfig";
import {
  DEFAULT_ENTRANCE_COUNT,
  ENTRANCE_CANOPY_DEPTH,
  ENTRANCE_CANOPY_HEIGHT,
  ENTRANCE_CANOPY_WIDTH,
  ENVIRONMENT_LENGTH,
  LANDMARK_DEPTH,
  LANDMARK_WIDTH,
  PLATFORM_WIDTH,
  STREET_LEVEL_DROP,
  UPPER_DECK_CLEARANCE,
  UPPER_DECK_THICKNESS,
  VIADUCT_COLUMN_RADIUS,
  VIADUCT_COLUMN_SPACING,
  VIADUCT_DECK_THICKNESS,
} from "@/lib/station3d/constants";

interface ElevatedEnvironmentProps {
  minX: number;
  maxX: number;
  architecture?: ArchitecturalProfile | undefined;
}

const deckMaterial = new THREE.MeshStandardMaterial({ color: "#6b6f76", roughness: 0.85 });
const columnMaterial = new THREE.MeshStandardMaterial({ color: "#5a5e66", roughness: 0.8 });
const groundMaterial = new THREE.MeshStandardMaterial({ color: "#4f5a46", roughness: 1 });
const roadMaterial = new THREE.MeshStandardMaterial({ color: "#33363c", roughness: 0.95 });
const roadMarkingMaterial = new THREE.MeshStandardMaterial({ color: "#d8cf9a", roughness: 0.8 });
const buildingMaterials = ["#8a7c66", "#7c8a92", "#9c8f7a", "#6f7a86"].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
);
const entranceRoofMaterial = new THREE.MeshStandardMaterial({ color: "#c8451a", roughness: 0.6 });
const entranceWallMaterial = new THREE.MeshStandardMaterial({ color: "#d9dde2", roughness: 0.7 });
const upperDeckMaterial = new THREE.MeshStandardMaterial({ color: "#5f636b", roughness: 0.85 });
const landmarkMaterials: Record<string, THREE.MeshStandardMaterial> = {
  PARK: new THREE.MeshStandardMaterial({ color: "#3f6b3a", roughness: 1 }),
  TRANSIT_HUB: new THREE.MeshStandardMaterial({ color: "#93765a", roughness: 0.85 }),
  INSTITUTION: new THREE.MeshStandardMaterial({ color: "#c9b98a", roughness: 0.8 }),
};

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
export function ElevatedEnvironment({ minX, maxX, architecture }: ElevatedEnvironmentProps) {
  const centerX = (minX + maxX) / 2;
  const deckWidth = maxX - minX + PLATFORM_WIDTH + 4;
  const length = ENVIRONMENT_LENGTH;
  const deckTop = -0.2;
  const deckY = deckTop - VIADUCT_DECK_THICKNESS / 2;
  const groundY = -STREET_LEVEL_DROP;
  const entranceCount = architecture?.entranceCount ?? DEFAULT_ENTRANCE_COUNT;
  const landmark = architecture?.landmark && architecture.landmark.type !== "NONE" ? architecture.landmark : undefined;

  const columnZs = useMemo(() => {
    const count = Math.max(2, Math.floor(length / VIADUCT_COLUMN_SPACING));
    return Array.from({ length: count }, (_, i) => -length / 2 + (i + 0.5) * (length / count));
  }, [length]);

  const entranceRoof = useMemo(
    () => (architecture?.accentColorHex ? new THREE.MeshStandardMaterial({ color: architecture.accentColorHex, roughness: 0.6 }) : entranceRoofMaterial),
    [architecture]
  );

  // Real entrances sit at the foot of the station's stairs, alternating sides along its length —
  // a schematic placement (exact positions aren't in the public sources used), not a survey fact.
  const entranceZs = useMemo(() => {
    const count = Math.max(1, entranceCount);
    const span = length * 0.5;
    return Array.from({ length: count }, (_, i) => -span / 2 + (i + 0.5) * (span / count));
  }, [entranceCount, length]);

  // Skip one street-side building slot when a landmark needs the room, so the landmark reads as
  // replacing generic infill rather than being squeezed in alongside it.
  const buildings = useMemo<BuildingSpec[]>(() => {
    const specs: BuildingSpec[] = [];
    const sides = [-1, 1];
    let seed = 0;
    for (const side of sides) {
      const skipLast = landmark && side === 1;
      const count = skipLast ? 4 : 5;
      for (let i = 0; i < count; i++) {
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
  }, [deckWidth, length, landmark]);

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

      {/* A documented crossing/stacked interchange (e.g. RV Road's perpendicular Green/Yellow Line
          viaducts) — a second deck at a different height, spanning across rather than parallel to
          this station's own deck. Never a modelled second platform; the shared layout engine only
          builds one level, so this is a structural suggestion only. */}
      {architecture?.hasMezzanine && (
        <group position={[0, deckY + UPPER_DECK_CLEARANCE, 0]}>
          <mesh material={upperDeckMaterial} castShadow receiveShadow>
            <boxGeometry args={[deckWidth + 40, UPPER_DECK_THICKNESS, 13]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * (deckWidth / 2 + 18), -(UPPER_DECK_CLEARANCE - (groundY - deckY)) / 2, 0]}
              material={columnMaterial}
              castShadow
            >
              <cylinderGeometry args={[VIADUCT_COLUMN_RADIUS, VIADUCT_COLUMN_RADIUS * 1.15, UPPER_DECK_CLEARANCE - (groundY - deckY), 12]} />
            </mesh>
          ))}
        </group>
      )}

      {/* Street-level entrance canopies — the real access points a rider actually walks through,
          absent from the generic shell entirely until a station's entrance count is researched. */}
      {entranceZs.map((z, i) => (
        <group key={i} position={[deckWidth / 2 + 4.5, groundY, z]}>
          <mesh position={[0, ENTRANCE_CANOPY_HEIGHT / 2, 0]} material={entranceWallMaterial} castShadow receiveShadow>
            <boxGeometry args={[ENTRANCE_CANOPY_DEPTH, ENTRANCE_CANOPY_HEIGHT, ENTRANCE_CANOPY_WIDTH]} />
          </mesh>
          <mesh position={[0, ENTRANCE_CANOPY_HEIGHT + 0.15, 0]} material={entranceRoof} castShadow>
            <boxGeometry args={[ENTRANCE_CANOPY_DEPTH + 0.8, 0.3, ENTRANCE_CANOPY_WIDTH + 0.8]} />
          </mesh>
        </group>
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

      {landmark && (
        <mesh
          position={[deckWidth / 2 + 14 + LANDMARK_WIDTH / 2, groundY + (landmark.type === "PARK" ? 0.4 : 5), 0]}
          material={landmarkMaterials[landmark.type] ?? buildingMaterials[0]!}
          castShadow={landmark.type !== "PARK"}
          receiveShadow
        >
          <boxGeometry args={[LANDMARK_WIDTH, landmark.type === "PARK" ? 0.8 : 10, LANDMARK_DEPTH]} />
        </mesh>
      )}
    </group>
  );
}

/** Deterministic 0..1 pseudo-random value, seeded by an integer — same trick as the passenger
 * layer's `scatterZ`, so the street context doesn't reshuffle every render. */
function pseudoRandom(seed: number): number {
  const t = Math.sin(seed * 12.9898) * 43758.5453;
  return t - Math.floor(t);
}
