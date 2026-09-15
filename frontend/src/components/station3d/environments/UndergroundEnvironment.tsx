import { useMemo } from "react";
import * as THREE from "three";
import type { ArchitecturalProfile } from "@/domain/stationConfig";
import {
  CANOPY_HEIGHT,
  ENVIRONMENT_LENGTH,
  MEZZANINE_CLEARANCE_ABOVE_TUNNEL,
  MEZZANINE_OPENING_FRACTION,
  MEZZANINE_THICKNESS,
  PLATFORM_HEIGHT,
  TUNNEL_HEIGHT,
  TUNNEL_WALL_MARGIN,
} from "@/lib/station3d/constants";

interface UndergroundEnvironmentProps {
  /** Local-X span of every platform module's outer edge, before this environment's own margin —
   * see `StationModel`'s footprint calculation, shared with `ElevatedEnvironment`/`AtGradeEnvironment`. */
  minX: number;
  maxX: number;
  architecture?: ArchitecturalProfile | undefined;
}

const wallMaterial = new THREE.MeshStandardMaterial({ color: "#171b24", roughness: 0.95, side: THREE.DoubleSide });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: "#10131a", roughness: 1, side: THREE.DoubleSide });
const mezzanineMaterial = new THREE.MeshStandardMaterial({ color: "#1c212c", roughness: 0.9, side: THREE.DoubleSide });
const lightStripMaterial = new THREE.MeshStandardMaterial({
  color: "#dce8ff",
  emissive: "#9fc2ff",
  emissiveIntensity: 1.4,
});

const LIGHT_SPACING = 9;
/** `depthMeters` beyond this reads as a genuinely deep cut-and-cover station (e.g. Majestic's
 * ~24m) rather than a shallow-bored one — widens/heightens the bore modestly rather than trying to
 * scale 1:1 to real depth, which would make the platform read tiny by comparison. */
const DEEP_STATION_THRESHOLD_M = 18;

/**
 * Level 3's UNDERGROUND shell: a bored tunnel — walls and ceiling wrapping every platform module,
 * lit by recessed strips rather than daylight, no sky/exterior of any kind. Deliberately doesn't
 * model the tunnel bore as circular (a box is a fair schematic simplification, same spirit as the
 * platform/track geometry) — the point is "enclosed underground volume," not a TBM cross-section.
 * `architecture` layers in real per-station facts where researched: a deeper/wider bore for a
 * documented deep station, an accent-tinted light strip, and — for a documented multi-level
 * interchange (`hasMezzanine`) — a lit mezzanine slab suggesting the concourse/second platform
 * level above, without modelling that level's own platform (the shared layout engine only builds
 * one level; see `references.json`'s disclosed limitation for the affected stations).
 */
export function UndergroundEnvironment({ minX, maxX, architecture }: UndergroundEnvironmentProps) {
  const centerX = (minX + maxX) / 2;
  const isDeep = (architecture?.depthMeters ?? 0) >= DEEP_STATION_THRESHOLD_M;
  const width = maxX - minX + TUNNEL_WALL_MARGIN * 2 * (isDeep ? 1.25 : 1);
  const tunnelHeight = isDeep ? TUNNEL_HEIGHT * 1.2 : TUNNEL_HEIGHT;
  const length = ENVIRONMENT_LENGTH;
  const accentLight = architecture?.accentColorHex;

  const lightPositions = useMemo(() => {
    const count = Math.max(2, Math.floor(length / LIGHT_SPACING));
    return Array.from({ length: count }, (_, i) => -length / 2 + (i + 0.5) * (length / count));
  }, [length]);

  const activeLightStripMaterial = useMemo(
    () =>
      accentLight
        ? new THREE.MeshStandardMaterial({ color: accentLight, emissive: accentLight, emissiveIntensity: 0.9 })
        : lightStripMaterial,
    [accentLight]
  );

  return (
    <group position={[centerX, 0, 0]}>
      <mesh position={[0, tunnelHeight, 0]} material={ceilingMaterial} receiveShadow>
        <boxGeometry args={[width, 0.4, length]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2, tunnelHeight / 2, 0]} material={wallMaterial} receiveShadow>
          <boxGeometry args={[0.4, tunnelHeight, length]} />
        </mesh>
      ))}

      {lightPositions.map((z) => (
        <mesh key={z} position={[0, tunnelHeight - 0.35, z]} material={activeLightStripMaterial}>
          <boxGeometry args={[width * 0.5, 0.08, 1.4]} />
        </mesh>
      ))}

      {architecture?.hasMezzanine && (
        <group position={[0, tunnelHeight + MEZZANINE_CLEARANCE_ABOVE_TUNNEL, 0]}>
          <mesh material={mezzanineMaterial} receiveShadow castShadow>
            <boxGeometry args={[width, MEZZANINE_THICKNESS, length]} />
          </mesh>
          {/* Lit opening down to the platform level below — reads as "there is another level up
              there," not a modelled second platform. */}
          <mesh position={[0, -0.02, 0]} material={activeLightStripMaterial}>
            <boxGeometry args={[width * MEZZANINE_OPENING_FRACTION, 0.05, length * 0.3]} />
          </mesh>
        </group>
      )}

      <pointLight position={[0, PLATFORM_HEIGHT + CANOPY_HEIGHT * 0.6, 0]} intensity={0.4} distance={40} color={accentLight ?? "#bcd4ff"} />
    </group>
  );
}
