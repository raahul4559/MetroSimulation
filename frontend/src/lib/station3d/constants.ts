/**
 * Shared procedural-geometry constants for the 3D station scene — scene-unit ("metre-ish") sizes,
 * not survey measurements. One place so every component (platform, track, train, camera) agrees on
 * where things sit, instead of each re-deriving its own offsets.
 */

/** Half the platform's length along the track axis — the platform runs from -HALF to +HALF. */
export const PLATFORM_HALF_LENGTH = 22;
export const PLATFORM_WIDTH = 7;
export const PLATFORM_HEIGHT = 1.1;

/** Lateral offset from platform centre to each track's centreline. */
export const TRACK_OFFSET = 4.2;
export const RAIL_GAUGE = 1.435;

/** How far the approach/departure track extends beyond the platform edge, in scene units — the
 * "visible window" a train animates through before/after the platform itself. */
export const APPROACH_LENGTH = 55;
export const DEPART_LENGTH = 55;

/** Lateral spacing between adjacent lines' platform modules at an interchange. */
export const MODULE_SPACING = 18;

export const CANOPY_HEIGHT = 6.5;
export const PILLAR_SPACING = 8;

export const TRAIN_CAR_LENGTH = 5.6;
export const TRAIN_CARS = 3;
export const TRAIN_LENGTH = TRAIN_CAR_LENGTH * TRAIN_CARS;
export const TRAIN_WIDTH = 2.9;
export const TRAIN_HEIGHT = 3.4;

/** Fraction of the backend's whole-track {@code progress} (0..1) at which an approaching train
 * enters this station's local visible scene — before that, it's still "out on the line" and simply
 * not rendered here (its real position is still accurate on the 2D map). */
export const APPROACH_VISIBLE_FROM = 0.7;

/** Fraction of {@code progress} up to which a just-departed train stays visible receding from this
 * station's scene. */
export const DEPART_VISIBLE_TO = 0.3;
