"use client";

import { Suspense, useMemo } from "react";
import type { PlatformLayout3D, StationLayout3D, TrainVisual3D } from "@/domain/station3d";
import type { Passenger } from "@/domain/trainsim";
import type { ResolvedStationAsset } from "@/domain/stationConfig";
import type { PlatformDestinations } from "@/lib/station3d/interchangeSignage";
import { MODULE_SPACING, PLATFORM_WIDTH } from "@/lib/station3d/constants";
import { atmosphereFor } from "@/lib/station3d/atmosphere";
import { Platform } from "./Platform";
import { Track } from "./Track";
import { StationSign } from "./StationSign";
import { MetroTrain3D } from "./MetroTrain3D";
import { Passengers3D } from "./Passengers3D";
import { StationEnvironment } from "./environments";
import { StationAssetModel } from "./StationAssetModel";
import { InterchangeWalkway } from "./InterchangeWalkway";
import { InterchangeConcourseSign } from "./InterchangeConcourseSign";

interface StationModelProps {
  layout: StationLayout3D;
  trains: readonly TrainVisual3D[];
  passengers: readonly Passenger[];
  asset: ResolvedStationAsset;
  platformDestinations: readonly PlatformDestinations[];
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
}

/**
 * The station environment, adapted to this station's real construction type and asset tier —
 * never one generic model reused everywhere. Platform/track/train/passenger geometry is always the
 * shared procedural layer (it's what the simulation's coordinate system is built around, see
 * `lib/station3d/position.ts`); what changes per station is the *shell* around it (`StationEnvironment`
 * for the procedural tiers, or a real `.glb` once `asset.modelAvailable` is true) and whether an
 * interchange's transfer walkway/concourse sign are present. No station name, line, or count is
 * ever written literally in this file.
 */
export function StationModel({
  layout,
  trains,
  passengers,
  asset,
  platformDestinations,
  selectedTrainId,
  onSelectTrain,
}: StationModelProps) {
  const trainsByLine = useMemo(() => {
    const map = new Map<string, TrainVisual3D[]>();
    for (const t of trains) {
      const list = map.get(t.lineCode) ?? [];
      list.push(t);
      map.set(t.lineCode, list);
    }
    return map;
  }, [trains]);

  const moduleXs = useMemo(() => layout.platforms.map((p) => p.moduleIndex * MODULE_SPACING), [layout.platforms]);
  const stationCenterX = (Math.min(...moduleXs, 0) + Math.max(...moduleXs, 0)) / 2;
  const minX = Math.min(...moduleXs) - PLATFORM_WIDTH / 2;
  const maxX = Math.max(...moduleXs) + PLATFORM_WIDTH / 2;
  const buildType = asset.config.buildType;
  const atmosphere = atmosphereFor(buildType);

  return (
    <group rotation={[0, layout.orientationRadians, 0]}>
      <ambientLight intensity={atmosphere.ambientIntensity} />
      <directionalLight position={[30, 50, 20]} intensity={buildType === "UNDERGROUND" ? 0.4 : 1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={[atmosphere.hemisphereSky, atmosphere.hemisphereGround, atmosphere.hemisphereIntensity]} />

      {asset.modelAvailable ? (
        <Suspense
          fallback={<StationEnvironment buildType={buildType} minX={minX} maxX={maxX} architecture={asset.config.architecture} />}
        >
          <StationAssetModel modelPath={asset.config.modelPath} />
        </Suspense>
      ) : (
        <StationEnvironment buildType={buildType} minX={minX} maxX={maxX} architecture={asset.config.architecture} />
      )}

      {layout.platforms.map((platform) => (
        <StationPlatformModule
          key={platform.lineCode}
          platform={platform}
          stationType={layout.stationType}
          stationName={layout.name}
          stationId={layout.stationId}
          trains={trainsByLine.get(platform.lineCode) ?? []}
          passengers={passengers}
          selectedTrainId={selectedTrainId}
          onSelectTrain={onSelectTrain}
        />
      ))}

      {asset.config.isInterchange && layout.platforms.length > 1 && (
        <>
          <InterchangeWalkway moduleXs={moduleXs} />
          <InterchangeConcourseSign
            position={[stationCenterX, 9.2, 3.5]}
            stationName={layout.name}
            destinations={platformDestinations}
          />
        </>
      )}

      <StationSign position={[stationCenterX, 8.5, -0.2]} stationName={layout.name} />
    </group>
  );
}

function StationPlatformModule({
  platform,
  stationType,
  stationName,
  stationId,
  trains,
  passengers,
  selectedTrainId,
  onSelectTrain,
}: {
  platform: PlatformLayout3D;
  stationType: StationLayout3D["stationType"];
  stationName: string;
  stationId: number;
  trains: readonly TrainVisual3D[];
  passengers: readonly Passenger[];
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

      <group position={[x, 0, 0]}>
        <Passengers3D passengers={passengers} stationId={stationId} platform={platform} trainsHere={trains} />
      </group>

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
