import type { Station } from "@/domain/metro";
import type { ViewTransform } from "@/lib/geometry/viewport";

/**
 * The map → 3D hand-off, as one explicit machine rather than a boolean.
 *
 * Previously this was a single `stationView3DId`: setting it unmounted the map and mounted the 3D
 * scene in the same frame. That produced a hard cut with a blank canvas while assets loaded, no
 * way back other than another hard cut, and — because the map's viewport state died with the
 * component — a camera that snapped back to fit-network on return.
 *
 * Each phase answers three questions the renderer needs: is the 2D map mounted, is the 3D scene
 * mounted, and how opaque is the transition scrim.
 *
 * Two framings are carried through every phase:
 *   `returnTransform` — the map framing captured the instant the operator asked for 3D. Carrying
 *      it is what lets the map come back to exactly where it was.
 *   `enterTransform`  — the close framing the zoom settles on (station centred). The map is
 *      re-mounted at it on the way out, so the reverse move starts from the same frame the 3D view
 *      replaced rather than jumping.
 */
export type StationImmersion =
  | { readonly phase: "map" }
  | {
      readonly phase:
        | "zooming-in"
        | "preparing"
        | "revealing"
        | "immersed"
        | "exit-fading"
        | "exit-zooming";
      readonly station: Station;
      readonly returnTransform: ViewTransform;
      readonly enterTransform: ViewTransform;
    };

export type StationImmersionPhase = StationImmersion["phase"];

export const IMMERSION_TIMINGS = {
  zoomInMs: 900,
  /** Floor on `preparing`, so a warm station doesn't flash the overlay for a single frame. */
  prepareMinMs: 420,
  /** Ceiling on `preparing`. A stalled asset must never trap the operator in the overlay. */
  prepareMaxMs: 8_000,
  revealMs: 700,
  exitFadeMs: 260,
  exitZoomMs: 850,
} as const;

/** The zoom the map settles on before handing off. Matches the value the old hand-off used. */
export const IMMERSION_ENTER_SCALE = 5;

export const IMMERSION_MAP: StationImmersion = { phase: "map" };

/** The 2D map stays mounted for every phase except the two where the 3D view owns the frame. */
export function isMapMounted(immersion: StationImmersion): boolean {
  return immersion.phase !== "immersed" && immersion.phase !== "exit-fading";
}

/** The 3D scene is mounted from the moment we start warming it up until it has finished fading. */
export function isSceneMounted(immersion: StationImmersion): boolean {
  return (
    immersion.phase === "preparing" ||
    immersion.phase === "revealing" ||
    immersion.phase === "immersed" ||
    immersion.phase === "exit-fading"
  );
}

/** Whether the transition overlay should be on screen at all. */
export function isTransitioning(immersion: StationImmersion): boolean {
  return immersion.phase !== "map" && immersion.phase !== "immersed";
}

/** The station being entered or left, or null on the plain map. */
export function immersionStation(immersion: StationImmersion): Station | null {
  return immersion.phase === "map" ? null : immersion.station;
}

/**
 * Scrim opacity, 0..1 — the single value that makes the cut invisible.
 *
 * `revealing`, `exit-fading` and `exit-zooming` name the value being transitioned *to*; CSS
 * animates from whatever the previous phase left on screen.
 */
export function scrimOpacity(immersion: StationImmersion): number {
  switch (immersion.phase) {
    case "map":
      return 0;
    case "zooming-in":
      return 0.45;
    case "preparing":
      return 1;
    case "revealing":
      return 0;
    case "immersed":
      return 0;
    case "exit-fading":
      return 1;
    case "exit-zooming":
      return 0;
  }
}

/**
 * How far the 2D layer has pulled back, 0..1 — 0 is the plain map, 1 is fully dollied past.
 *
 * The apparent camera movement through the transition is a CSS transform on the layer wrappers,
 * never a move of the three.js camera. See `CameraController`'s own notes: it sets the camera
 * synchronously during render so a freshly-keyed OrbitControls constructs against the right
 * position, and animating the camera from outside that arrangement desynchronises the two.
 */
export function mapLayerProgress(immersion: StationImmersion): number {
  switch (immersion.phase) {
    case "map":
      return 0;
    case "zooming-in":
      return 0.35;
    case "preparing":
    case "revealing":
    case "immersed":
    case "exit-fading":
      return 1;
    case "exit-zooming":
      return 0;
  }
}

/** How far the 3D layer has settled, 0..1 — 0 is pushed back and invisible, 1 is fully arrived. */
export function sceneLayerProgress(immersion: StationImmersion): number {
  switch (immersion.phase) {
    case "map":
    case "zooming-in":
    case "preparing":
      return 0;
    case "revealing":
    case "immersed":
      return 1;
    case "exit-fading":
    case "exit-zooming":
      return 0;
  }
}
