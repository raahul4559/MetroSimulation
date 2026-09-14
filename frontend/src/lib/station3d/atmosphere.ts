import type { StationBuildType } from "@/domain/stationConfig";

/** Background/fog/ambient-light preset for a build type — the thing that stops an underground
 * station from ever looking like it's sitting under an open sky, and vice versa. Pure data, read
 * by both the `Canvas`-level background/fog (`StationScene`) and the scene's own lights
 * (`StationModel`) so the two never disagree about what kind of space this is. */
export interface SceneAtmosphere {
  readonly background: string;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly ambientIntensity: number;
  readonly hemisphereSky: string;
  readonly hemisphereGround: string;
  readonly hemisphereIntensity: number;
}

const UNDERGROUND: SceneAtmosphere = {
  background: "#05070d",
  fogNear: 26,
  fogFar: 85,
  ambientIntensity: 0.32,
  hemisphereSky: "#2a3446",
  hemisphereGround: "#0c0e13",
  hemisphereIntensity: 0.28,
};

const ELEVATED: SceneAtmosphere = {
  background: "#7fb2dd",
  fogNear: 90,
  fogFar: 300,
  ambientIntensity: 0.6,
  hemisphereSky: "#bcd4f6",
  hemisphereGround: "#3a352c",
  hemisphereIntensity: 0.5,
};

const AT_GRADE: SceneAtmosphere = {
  background: "#9cc3e6",
  fogNear: 75,
  fogFar: 260,
  ambientIntensity: 0.65,
  hemisphereSky: "#cfe4fa",
  hemisphereGround: "#4a4534",
  hemisphereIntensity: 0.55,
};

export function atmosphereFor(buildType: StationBuildType): SceneAtmosphere {
  switch (buildType) {
    case "UNDERGROUND":
      return UNDERGROUND;
    case "AT_GRADE":
      return AT_GRADE;
    case "ELEVATED":
    default:
      return ELEVATED;
  }
}
