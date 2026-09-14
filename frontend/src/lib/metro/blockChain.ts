import type { Line, Track } from "@/domain/metro";
import type { TrainDirection } from "@/domain/trainsim";

export interface BlockChain {
  readonly currentTrackId: number | null;
  readonly nextTrackId: number | null;
}

function orderedStationIds(line: Line, direction: TrainDirection): number[] {
  const ids = line.stations.map((s) => s.id);
  return direction === "OUTBOUND" ? ids : [...ids].reverse();
}

function findTrack(tracks: readonly Track[], stationIdA: number, stationIdB: number): Track | null {
  return (
    tracks.find(
      (t) =>
        (t.fromStationId === stationIdA && t.toStationId === stationIdB) ||
        (t.fromStationId === stationIdB && t.toStationId === stationIdA)
    ) ?? null
  );
}

/**
 * The "current block / next block" a train's debug chain shows — mirrors the backend's own
 * `downstreamTrackId` lookahead (`TrainMovementTickHandler`) so the two never disagree. While a
 * train is physically in a block (`currentTrackId` set), "next" is the block after the station
 * it's headed to (the same lookahead the speed-restriction logic uses); while it's waiting at a
 * station, "next" is simply the block it's trying to enter.
 */
export function computeBlockChain(
  train: {
    lineCode: string;
    direction: TrainDirection;
    previousStationId: number;
    nextStationId: number;
    currentTrackId: number | null;
  },
  lines: readonly Line[],
  tracks: readonly Track[]
): BlockChain {
  if (train.currentTrackId != null) {
    const line = lines.find((l) => l.code === train.lineCode);
    let downstream: number | null = null;
    if (line) {
      const order = orderedStationIds(line, train.direction);
      const index = order.indexOf(train.nextStationId);
      const afterId = index >= 0 && index + 1 < order.length ? order[index + 1] : null;
      downstream = afterId != null ? (findTrack(tracks, train.nextStationId, afterId)?.id ?? null) : null;
    }
    return { currentTrackId: train.currentTrackId, nextTrackId: downstream };
  }

  const pending =
    train.previousStationId !== train.nextStationId
      ? findTrack(tracks, train.previousStationId, train.nextStationId)?.id ?? null
      : null;
  return { currentTrackId: null, nextTrackId: pending };
}
