import type { ArchitecturalProfile, StationBuildType } from "@/domain/stationConfig";
import { UndergroundEnvironment } from "./UndergroundEnvironment";
import { ElevatedEnvironment } from "./ElevatedEnvironment";
import { AtGradeEnvironment } from "./AtGradeEnvironment";

export { UndergroundEnvironment, ElevatedEnvironment, AtGradeEnvironment };

interface StationEnvironmentProps {
  buildType: StationBuildType;
  minX: number;
  maxX: number;
  /** This station's researched architecture facts, if any (see `ArchitecturalProfile`) — absent
   * for every uncurated/synthesized station, which renders the plain generic shell below. */
  architecture?: ArchitecturalProfile | undefined;
}

/**
 * Picks the one environment shell that matches this station's real construction type — the piece
 * of the spec that says "an underground station must never sit on an elevated viaduct just because
 * the generic model does that." Every variant takes the same `minX`/`maxX` footprint, computed
 * once by `StationModel` from the real platform layout, plus whatever station-specific
 * `architecture` facts exist to differentiate it beyond build type alone.
 */
export function StationEnvironment({ buildType, minX, maxX, architecture }: StationEnvironmentProps) {
  switch (buildType) {
    case "UNDERGROUND":
      return <UndergroundEnvironment minX={minX} maxX={maxX} architecture={architecture} />;
    case "AT_GRADE":
      return <AtGradeEnvironment minX={minX} maxX={maxX} />;
    case "ELEVATED":
    default:
      return <ElevatedEnvironment minX={minX} maxX={maxX} architecture={architecture} />;
  }
}
