import type { Station } from "./metro/station";
import type { TrainDirection } from "./trainsim/trainState";

/**
 * The visual phase a train is in at a specific station, derived entirely from that train's real
 * {@code TrainStatus} plus whether the station is its {@code previousStationId} or
 * {@code nextStationId} (see {@code lib/station3d/trainVisual.ts}) — never a client-side timer or
 * invented state. Mirrors the arrival sequence from the 3D spec, minus a separate "DOORS_CLOSE"
 * entry: doors close is just the moment {@code BOARDING} ends, read directly off the phase
 * transition rather than modeled as its own phase.
 */
export type TrainPhase3D = "APPROACHING" | "ARRIVING" | "STOPPED" | "BOARDING" | "DEPARTING";

/**
 * One line's platform module at a station — one per line serving the station (an island platform
 * with a track on each side, one per direction), laid out side by side. {@code outboundNeighborId}/
 * {@code inboundNeighborId} are this line's real adjacent stations (from {@code Line.stations}'
 * order, the same order the backend's own dispatcher uses for OUTBOUND/INBOUND) — {@code null} at a
 * line terminus, where that track simply has nowhere to approach from or depart to.
 */
export interface PlatformLayout3D {
  readonly lineCode: string;
  readonly lineName: string;
  readonly colorHex: string;
  readonly moduleIndex: number;
  readonly platformNumber: number;
  readonly outboundNeighborId: number | null;
  readonly inboundNeighborId: number | null;
}

/**
 * A station's procedural 3D layout — everything {@code StationModel} needs to place platforms,
 * tracks, and signage, computed once from real network data (see
 * {@code lib/station3d/layout.ts#buildStationLayout3D}). Never authored per-station; a station with
 * no real asset under {@code stations/<slug>/} is rendered from this layout alone.
 */
export interface StationLayout3D {
  readonly stationId: number;
  readonly code: string;
  readonly name: string;
  readonly stationType: Station["stationType"];
  /** Radians to rotate the whole station group around Y so local +Z (every platform's "outbound"
   * direction) points toward the real-world bearing of the primary line's next station. A
   * schematic simplification — every platform module shares this one orientation even at an
   * interchange, the same "not survey-accurate" spirit as the 2D map's own projection. */
  readonly orientationRadians: number;
  readonly platforms: readonly PlatformLayout3D[];
}

/** One train's renderable state at a specific station — position/phase already resolved from the
 * shared simulation state, never advanced by a clock of its own. */
export interface TrainVisual3D {
  readonly trainId: number;
  readonly code: string;
  readonly lineCode: string;
  readonly colorHex: string;
  readonly direction: TrainDirection;
  readonly phase: TrainPhase3D;
  /** 0..1 within the *visible* segment for this phase (approach/platform/departure) — a remap of
   * the backend's whole-track {@code progress}, not that raw value. See
   * {@code lib/station3d/trainVisual.ts} for the remap windows. */
  readonly localProgress: number;
  readonly passengerCount: number;
  readonly capacity: number;
  readonly delaySeconds: number;
  readonly destinationStationName: string;
}

export type CameraMode3D = "OVERVIEW" | "PASSENGER" | "FOLLOW" | "FREE";
