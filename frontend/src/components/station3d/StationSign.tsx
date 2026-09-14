"use client";

import { Text } from "@react-three/drei";

interface StationSignProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  stationName: string;
  /** Present only on a platform-level sign (line name / platform number / live destination) — the
   * station-identity sign at the concourse entrance omits it. */
  platform?: {
    lineName: string;
    platformNumber: number;
    colorHex: string;
    destination: string | null;
  };
}

/**
 * Dynamic 3D signage, entirely from real data passed in — never a station name or line baked into
 * this component. Two shapes in one component rather than two: a bare identity sign (station name
 * only, e.g. at a concourse entrance) and a platform sign (adds line/platform/destination), because
 * they're the same physical object with a different amount of real data available to print on it.
 */
export function StationSign({ position, rotation = [0, 0, 0], stationName, platform }: StationSignProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[3.6, platform ? 1.9 : 1.1, 0.08]} />
        <meshStandardMaterial color="#0b1220" roughness={0.6} />
      </mesh>
      {platform && (
        <mesh position={[-1.65, 1.9 / 2 - 0.06, 0.001]}>
          <boxGeometry args={[0.12, 1.9 - 0.12, 0.02]} />
          <meshStandardMaterial color={platform.colorHex} />
        </mesh>
      )}

      <Text
        position={[platform ? 0.05 : 0, platform ? 0.62 : 0.15, 0]}
        fontSize={platform ? 0.28 : 0.34}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
      >
        NAMMA METRO
      </Text>
      <Text
        position={[platform ? 0.05 : 0, platform ? 0.28 : -0.22, 0]}
        fontSize={platform ? 0.34 : 0.42}
        color="#facc15"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {stationName.toUpperCase()}
      </Text>

      {platform && (
        <>
          <Text position={[0.05, -0.1, 0]} fontSize={0.22} color="#e2e8f0" anchorX="center" anchorY="middle">
            {platform.lineName}
          </Text>
          <Text position={[0.05, -0.42, 0]} fontSize={0.2} color="#94a3b8" anchorX="center" anchorY="middle">
            {`Platform ${platform.platformNumber}`}
          </Text>
          <Text position={[0.05, -0.72, 0]} fontSize={0.2} color="#94a3b8" anchorX="center" anchorY="middle">
            {platform.destination ? `Destination: ${platform.destination}` : "No train approaching"}
          </Text>
        </>
      )}
    </group>
  );
}
