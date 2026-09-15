/**
 * Pure types and constants for the station scene's composite load progress.
 *
 * Split out of `useStationSceneLoad.ts` deliberately: that hook imports `@react-three/drei` for
 * `useProgress`, and anything that imports the hook module — even just for its types — pulls the
 * entire three.js/R3F/drei stack into its bundle. `StationTransitionOverlay` needs the *shape* of
 * a load result to render its progress bar, but has no reason to load three.js itself; it now
 * imports from here instead, so the plain network map (which renders the overlay during the
 * hand-off, but never the 3D canvas until a station is actually entered) stays free of the 3D
 * bundle on first load.
 */

export type SceneLoadStage = "locating" | "environment" | "architecture" | "entering";

export interface StationSceneLoad {
  /** 0..1, monotonic within one entry — never goes backwards, even if a source resets. */
  readonly progress: number;
  readonly stage: SceneLoadStage;
  /** Every gate satisfied: assets resolved, model (if any) finished, first frames drawn. */
  readonly ready: boolean;
  /** No real model exists for this station — the scene is a procedural reconstruction. */
  readonly procedural: boolean;
}

export const SCENE_LOAD_MESSAGE: Record<SceneLoadStage, string> = {
  locating: "Locating station",
  environment: "Resolving geographic environment",
  architecture: "Building station architecture",
  entering: "Entering platform",
};
