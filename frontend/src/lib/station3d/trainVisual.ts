import type { Line, Station } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import type { PlatformLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import { APPROACH_VISIBLE_FROM, DEPART_VISIBLE_TO } from "./constants";

/**
 * Resolves every train relevant to this station into a {@link TrainVisual3D} — the single place
 * that turns the shared {@code SimulationState.trains} into what the 3D scene renders. A train not
 * currently at, approaching, or just having left this exact station (by real
 * {@code previousStationId}/{@code nextStationId}, the same fields the 2D map reads) simply isn't
 * returned; there is no separate roster or timer tracking trains for the 3D view.
 */
export function selectStationTrainVisuals(
  trains: readonly TrainState[],
  stationId: number,
  platformsByLine: ReadonlyMap<string, PlatformLayout3D>,
  lineByCode: ReadonlyMap<string, Line>,
  stationsById: ReadonlyMap<number, Station>
): TrainVisual3D[] {
  const visuals: TrainVisual3D[] = [];
  for (const train of trains) {
    const platform = platformsByLine.get(train.lineCode);
    if (!platform) continue;
    const resolved = resolvePhase(train, stationId);
    if (!resolved) continue;
    const line = lineByCode.get(train.lineCode);
    visuals.push({
      trainId: train.id,
      code: train.code,
      lineCode: train.lineCode,
      colorHex: line?.colorHex ?? "#94a3b8",
      direction: train.direction,
      phase: resolved.phase,
      localProgress: resolved.localProgress,
      passengerCount: train.passengerCount,
      capacity: train.capacity,
      delaySeconds: train.delaySeconds,
      destinationStationName: destinationName(train, line, stationsById),
    });
  }
  return visuals;
}

function resolvePhase(train: TrainState, stationId: number): { phase: TrainPhase3D; localProgress: number } | null {
  const arrivingHere = train.nextStationId === stationId && train.previousStationId !== stationId;
  const stationaryHere = train.previousStationId === stationId && train.nextStationId === stationId;
  const departingHere = train.previousStationId === stationId && train.nextStationId !== stationId;

  if (arrivingHere) {
    if (train.status === "ARRIVING") {
      return { phase: "ARRIVING", localProgress: 1 };
    }
    if ((train.status === "RUNNING" || train.status === "DEPARTING") && train.progress >= APPROACH_VISIBLE_FROM) {
      const localProgress = (train.progress - APPROACH_VISIBLE_FROM) / (1 - APPROACH_VISIBLE_FROM);
      return { phase: "APPROACHING", localProgress: clamp01(localProgress) };
    }
    return null;
  }

  if (stationaryHere) {
    if (train.status === "AT_STATION" || train.status === "COMPLETED") {
      return { phase: "STOPPED", localProgress: 1 };
    }
    if (train.status === "DWELLING") {
      return { phase: "BOARDING", localProgress: 1 };
    }
    return null;
  }

  if (departingHere) {
    if (train.status === "DEPARTING") {
      return { phase: "DEPARTING", localProgress: 0 };
    }
    if (
      (train.status === "RUNNING" || train.status === "STOPPED" || train.status === "DELAYED") &&
      train.progress <= DEPART_VISIBLE_TO
    ) {
      return { phase: "DEPARTING", localProgress: clamp01(train.progress / DEPART_VISIBLE_TO) };
    }
    return null;
  }

  return null;
}

/** A train's ultimate terminus, derived from its line's real station order and direction — OUTBOUND
 * ends at the line's last station, INBOUND at its first, exactly how `TrainDispatcher`/
 * `LineScheduleAssembler` build the route on the backend. Not a field the backend sends (only the
 * current leg's endpoints are), so it's derived here rather than duplicated as separate state. */
function destinationName(train: TrainState, line: Line | undefined, stationsById: ReadonlyMap<number, Station>): string {
  if (!line || line.stations.length === 0) return "";
  const terminus = train.direction === "OUTBOUND" ? line.stations[line.stations.length - 1] : line.stations[0];
  return (terminus && stationsById.get(terminus.id)?.name) ?? terminus?.name ?? "";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
