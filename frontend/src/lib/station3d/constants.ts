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
export const TRAIN_CAR_GAP = 0.3;
export const TRAIN_LENGTH = TRAIN_CAR_LENGTH * TRAIN_CARS + (TRAIN_CARS - 1) * TRAIN_CAR_GAP;
export const TRAIN_WIDTH = 2.9;
export const TRAIN_HEIGHT = 3.4;

/** Fraction of the backend's whole-track {@code progress} (0..1) at which an approaching train
 * enters this station's local visible scene — before that, it's still "out on the line" and simply
 * not rendered here (its real position is still accurate on the 2D map). */
export const APPROACH_VISIBLE_FROM = 0.7;

/** Fraction of {@code progress} up to which a just-departed train stays visible receding from this
 * station's scene. */
export const DEPART_VISIBLE_TO = 0.3;

/**
 * Build-type environment constants — the surrounding "shell" a station sits inside, distinct from
 * the platform/track/canopy constants above which describe the platform module itself. Shared by
 * `components/station3d/environments/*` so every build type agrees on scale.
 */

/** Overall visible length (along Z) an environment shell renders — generous enough to cover the
 * platform plus a good stretch of approach/departure track without matching `APPROACH_LENGTH`/
 * `DEPART_LENGTH` exactly (the environment is a backdrop, not a precise track model). */
export const ENVIRONMENT_LENGTH = PLATFORM_HALF_LENGTH * 2 + 90;

/** Underground: clearance from the platform's outer edge to the tunnel wall, and the tunnel's
 * total clear height above the platform deck (comfortably above the canopy). */
export const TUNNEL_WALL_MARGIN = 6;
export const TUNNEL_HEIGHT = 10.5;

/** Elevated: viaduct deck thickness beneath the platform, column footprint, spacing between
 * columns along the viaduct's length, and how far below the platform deck street level sits. */
export const VIADUCT_DECK_THICKNESS = 1.4;
export const VIADUCT_COLUMN_RADIUS = 0.9;
export const VIADUCT_COLUMN_SPACING = 22;
export const STREET_LEVEL_DROP = 13;

/** At-grade: boundary fence height and post spacing along the platform's open edges. */
export const AT_GRADE_FENCE_HEIGHT = 1.3;
export const AT_GRADE_FENCE_POST_SPACING = 4;

/**
 * Station-specific `ArchitecturalProfile` geometry constants — the small, additive detail layer
 * that differentiates a researched station from the generic build-type shell above, without
 * touching the shared platform/track/layout engine. Fallback default used whenever a curated
 * station's profile leaves a field unset.
 */

/** Street-level entrance canopy footprint/height, and how far apart entrances are spread along
 * the station's length when `ArchitecturalProfile.entranceCount` is set. */
export const ENTRANCE_CANOPY_WIDTH = 5;
export const ENTRANCE_CANOPY_DEPTH = 4;
export const ENTRANCE_CANOPY_HEIGHT = 3.2;
export const DEFAULT_ENTRANCE_COUNT = 2;

/** Underground mezzanine slab: how far above the tunnel ceiling it sits, its thickness, and the
 * width of the lit opening down to the platform level it suggests — never a full second-level
 * platform, since the shared layout engine only builds one level. */
export const MEZZANINE_CLEARANCE_ABOVE_TUNNEL = 3.2;
export const MEZZANINE_THICKNESS = 0.5;
export const MEZZANINE_OPENING_FRACTION = 0.4;

/** Elevated "second level" slab suggesting a stacked interchange (e.g. RV Road's Green/Yellow
 * viaducts) — sits above the main deck rather than replacing it. */
export const UPPER_DECK_CLEARANCE = 6.5;
export const UPPER_DECK_THICKNESS = 1.1;

/** A single context landmark shape (park patch / transit-hub massing / institution block) rendered
 * in place of one of the generic street buildings when `ArchitecturalProfile.landmark` is set. */
export const LANDMARK_WIDTH = 26;
export const LANDMARK_DEPTH = 22;
