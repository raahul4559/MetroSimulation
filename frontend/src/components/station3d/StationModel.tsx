"use client";

import { useMemo } from "react";
import type { PlatformLayout3D, StationLayout3D, TrainVisual3D } from "@/domain/station3d";
import { MODULE_SPACING } from "@/lib/station3d/constants";
import { Platform } from "./Platform";
import { Track } from "./Track";
import { StationSign } from "./StationSign";
import { MetroTrain3D } from "./MetroTrain3D";

interface StationModelProps {
  layout: StationLayout3D;
  trains: readonly TrainVisual3D[];
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
}

/**
 * The procedural station environment: one platform + a track either side per line, laid out side
 * by side, plus signage and every currently-visible train. Everything here is derived from
 * `layout`/`trains` (both built upstream from real `SimulationState`/network data) — no station
 * name, line, or count is ever written literally in this file.
 */
export function StationModel({ layout, trains, selectedTrainId, onSelectTrain }: StationModelProps) {
  const trainsByLine = useMemo(() => {
    const map = new Map<string, TrainVisual3D[]>();
    for (const t of trains) {
      const list = map.get(t.lineCode) ?? [];
      list.push(t);
      map.set(t.lineCode, list);
    }
    return map;
  }, [trains]);

  return (
    <group rotation={[0, layout.orientationRadians, 0]}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 50, 20]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={["#bcd4f6", "#3a352c", 0.5]} />

      <mesh position={[((layout.platforms.length - 1) * MODULE_SPACING) / 2, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[layout.platforms.length * MODULE_SPACING + 140, 260]} />
        <meshStandardMaterial color="#2a2f38" roughness={1} />
      </mesh>

      {layout.platforms.map((platform) => (
        <StationPlatformModule
          key={platform.lineCode}
          platform={platform}
          stationType={layout.stationType}
          stationName={layout.name}
          trains={trainsByLine.get(platform.lineCode) ?? []}
          selectedTrainId={selectedTrainId}
          onSelectTrain={onSelectTrain}
        />
      ))}

      <StationSign position={[((layout.platforms.length - 1) * MODULE_SPACING) / 2, 8.5, -0.2]} stationName={layout.name} />
    </group>
  );
}

function StationPlatformModule({
  platform,
  stationType,
  stationName,
  trains,
  selectedTrainId,
  onSelectTrain,
}: {
  platform: PlatformLayout3D;
  stationType: StationLayout3D["stationType"];
  stationName: string;
  trains: readonly TrainVisual3D[];
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
}) {
  const x = platform.moduleIndex * MODULE_SPACING;
  const outboundHasApproach = platform.inboundNeighborId != null;
  const outboundHasDepart = platform.outboundNeighborId != null;
  const inboundHasApproach = platform.outboundNeighborId != null;
  const inboundHasDepart = platform.inboundNeighborId != null;

  const approachingOrBoarding = trains.find((t) => t.phase === "APPROACHING" || t.phase === "BOARDING" || t.phase === "STOPPED");

  return (
    <group>
      <Track x={x + 4.2} hasApproach={outboundHasApproach} hasDepart={outboundHasDepart} />
      <Track x={x - 4.2} hasApproach={inboundHasApproach} hasDepart={inboundHasDepart} />
      <Platform x={x} colorHex={platform.colorHex} stationType={stationType} />

      <StationSign
        position={[x, 4.6, 3.6]}
        rotation={[0, Math.PI, 0]}
        stationName={stationName}
        platform={{
          lineName: platform.lineName,
          platformNumber: platform.platformNumber,
          colorHex: platform.colorHex,
          destination: approachingOrBoarding?.destinationStationName ?? null,
        }}
      />

      {trains.map((visual) => (
        <MetroTrain3D
          key={visual.trainId}
          visual={visual}
          platform={platform}
          selected={visual.trainId === selectedTrainId}
          onSelect={() => onSelectTrain(visual.trainId)}
        />
      ))}
    </group>
  );
}
