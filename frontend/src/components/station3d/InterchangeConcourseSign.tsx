"use client";

import { Text } from "@react-three/drei";
import type { PlatformDestinations } from "@/lib/station3d/interchangeSignage";

interface InterchangeConcourseSignProps {
  position: readonly [number, number, number];
  stationName: string;
  destinations: readonly PlatformDestinations[];
}

const ROW_HEIGHT = 0.5;

/**
 * The concourse-level overview sign an interchange needs beyond each platform's own sign: every
 * line serving the station, and every platform's real two-way destinations, in one place — "PLATFORM
 * 1 → Whitefield / Kengeri" per the spec's interchange signage example. Built entirely from
 * `destinations` (real line/platform data resolved in `StationScene`); never a station or line name
 * literally written here. Only ever mounted when `StationConfig.isInterchange` is true.
 */
export function InterchangeConcourseSign({ position, stationName, destinations }: InterchangeConcourseSignProps) {
  const boardHeight = 1.3 + destinations.length * ROW_HEIGHT;

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[5.2, boardHeight, 0.1]} />
        <meshStandardMaterial color="#0b1220" roughness={0.6} />
      </mesh>

      <Text position={[0, boardHeight / 2 - 0.35, 0.02]} fontSize={0.3} color="#f8fafc" anchorX="center" anchorY="middle" letterSpacing={0.05}>
        NAMMA METRO — {stationName.toUpperCase()}
      </Text>
      <Text position={[0, boardHeight / 2 - 0.75, 0.02]} fontSize={0.2} color="#94a3b8" anchorX="center" anchorY="middle">
        {destinations.map((d) => d.lineName).join("  •  ")}
      </Text>

      {destinations.map((d, i) => (
        <group key={d.lineCode} position={[0, boardHeight / 2 - 1.25 - i * ROW_HEIGHT, 0.02]}>
          <mesh position={[-2.3, 0, 0]}>
            <boxGeometry args={[0.12, ROW_HEIGHT - 0.12, 0.02]} />
            <meshStandardMaterial color={d.colorHex} />
          </mesh>
          <Text position={[-1.95, 0, 0]} fontSize={0.19} color="#e2e8f0" anchorX="left" anchorY="middle">
            {`Platform ${d.platformNumber}`}
          </Text>
          <Text position={[0.6, 0, 0]} fontSize={0.17} color="#cbd5e1" anchorX="left" anchorY="middle">
            {`→ ${d.outboundTerminusName || "—"} / ${d.inboundTerminusName || "—"}`}
          </Text>
        </group>
      ))}
    </group>
  );
}
