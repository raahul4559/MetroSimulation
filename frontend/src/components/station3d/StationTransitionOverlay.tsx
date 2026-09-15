"use client";

import type { Line, Station } from "@/domain/metro";
import type { StationConfig } from "@/domain/stationConfig";
import { atmosphereFor } from "@/lib/station3d/atmosphere";
import { getLinesForStation } from "@/lib/metro/selectors";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { LineBadge } from "@/components/ui/LineBadge";
import { SCENE_LOAD_MESSAGE, type StationSceneLoad } from "@/hooks/useStationSceneLoad";

const BUILD_TYPE_LABEL: Record<StationConfig["buildType"], string> = {
  ELEVATED: "Elevated station",
  UNDERGROUND: "Underground station",
  AT_GRADE: "At-grade station",
};

interface StationTransitionOverlayProps {
  station: Station;
  config: StationConfig;
  lines: readonly Line[];
  load: StationSceneLoad;
  /** 0..1. Owned by the transition machine, applied here so the overlay dissolves rather than cuts. */
  opacity: number;
}

/**
 * The premium loading state between the map and a station's 3D scene.
 *
 * The detail that sells the hand-off: the backdrop is seeded from
 * `atmosphereFor(buildType).background` — the exact colour the 3D scene uses for its own
 * `<color attach="background">` and fog. So when this overlay fades out, the background colour
 * behind it never changes; only detail resolves into it. That is the "geographic environment →
 * station architecture" beat, and it costs one import of an already-pure function.
 *
 * The architecture caption tells the truth about what is being built. No station in this project
 * currently ships a real `.glb`, so most of the time the honest answer is "procedural
 * reconstruction" — consistent with this codebase's refusal elsewhere to present an approximation
 * as exact (see `stationConfigs.ts`, `assetAvailability.ts`, `ReferencePanel`).
 */
export function StationTransitionOverlay({
  station,
  config,
  lines,
  load,
  opacity,
}: StationTransitionOverlayProps) {
  const atmosphere = atmosphereFor(config.buildType);
  const stationLines = getLinesForStation(station, lines);

  const message =
    load.stage === "architecture" && load.procedural
      ? "Building station architecture — procedural reconstruction"
      : SCENE_LOAD_MESSAGE[load.stage];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[var(--z-transition)] transition-opacity duration-(--duration-slow) ease-(--ease-out)"
      style={{ opacity }}
      aria-hidden={opacity === 0}
    >
      {/* A radial wash from the destination scene's own sky/tunnel colour into near-black. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 45%, ${atmosphere.background} 0%, var(--color-canvas) 78%)`,
        }}
      />

      <LoadingOverlay
        title={station.name}
        message={message}
        progress={load.progress}
        context={`${station.code} · ${BUILD_TYPE_LABEL[config.buildType]}${
          config.isInterchange ? " · Interchange" : ""
        }`}
        className="bg-transparent"
      />

      <div className="absolute inset-x-0 bottom-10 flex flex-wrap justify-center gap-1.5 px-6">
        {stationLines.map((line) => (
          <LineBadge key={line.id} line={line} />
        ))}
      </div>
    </div>
  );
}
