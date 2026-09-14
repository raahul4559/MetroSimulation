import type { Station } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import type { Point, Projector } from "@/lib/geometry/projection";

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
