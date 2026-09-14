import type { StationBuildType } from "@/domain/stationConfig";
import { UndergroundEnvironment } from "./UndergroundEnvironment";
import { ElevatedEnvironment } from "./ElevatedEnvironment";
import { AtGradeEnvironment } from "./AtGradeEnvironment";

export { UndergroundEnvironment, ElevatedEnvironment, AtGradeEnvironment };

interface StationEnvironmentProps {
  buildType: StationBuildType;
  minX: number;
  maxX: number;
}

/**
 * Picks the one environment shell that matches this station's real construction type — the piece
 * of the spec that says "an underground station must never sit on an elevated viaduct just because
 * the generic model does that." Every variant takes the same `minX`/`maxX` footprint, computed
 * once by `StationModel` from the real platform layout.
 */
export function StationEnvironment({ buildType, minX, maxX }: StationEnvironmentProps) {
  switch (buildType) {
    case "UNDERGROUND":
      return <UndergroundEnvironment minX={minX} maxX={maxX} />;
    case "AT_GRADE":
      return <AtGradeEnvironment minX={minX} maxX={maxX} />;
    case "ELEVATED":
    default:
      return <ElevatedEnvironment minX={minX} maxX={maxX} />;
  }
}
