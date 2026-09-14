import type { Station, Track } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import type { Point, Projector } from "@/lib/geometry/projection";

/** How far along a track, from its `fromStationId` end, a signal's marker is drawn — a signal
 * stands at the entrance to the block it protects, so this sits close to the origin station
 * rather than at the track's midpoint. */
const SIGNAL_ANCHOR_T = 0.15;

/** Where a track's signal renders: a fixed point near its origin station, not train-progress-based. */
export function signalAnchorPoint(
  track: Pick<Track, "fromStationId" | "toStationId">,
  stationsById: ReadonlyMap<number, Station>,
  project: Projector
): Point | null {
  const from = stationsById.get(track.fromStationId);
  const to = stationsById.get(track.toStationId);
  if (!from || !to) return null;

  const p1 = project(from);
  const p2 = project(to);
  return {
    x: p1.x + (p2.x - p1.x) * SIGNAL_ANCHOR_T,
    y: p1.y + (p2.y - p1.y) * SIGNAL_ANCHOR_T,
  };
}

/**
 * A train's current map position: interpolated between its previous and next station by
 * `progress` while moving, or pinned to its previous station while stationary (SCHEDULED,
 * AT_STATION, DWELLING, COMPLETED all report `previousStationId === nextStationId`). Returns
 * `null` only if the train references a station id the network doesn't have — shouldn't happen
 * against a consistent backend, but visualization code shouldn't crash if it does.
 */
export function interpolateTrainPoint(
  train: Pick<TrainState, "previousStationId" | "nextStationId" | "progress">,
  stationsById: ReadonlyMap<number, Station>,
  project: Projector
): Point | null {
  const previous = stationsById.get(train.previousStationId);
  if (!previous) return null;

  const next = stationsById.get(train.nextStationId);
  if (!next || train.nextStationId === train.previousStationId) {
    return project(previous);
  }

  const from = project(previous);
  const to = project(next);
  return {
    x: from.x + (to.x - from.x) * train.progress,
    y: from.y + (to.y - from.y) * train.progress,
  };
}
