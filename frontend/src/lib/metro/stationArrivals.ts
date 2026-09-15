import type { Line, Station, Track } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";

/**
 * Which trains are about to reach a station, and when.
 *
 * Purely a display-layer derivation over state the simulation already streams: a train's current
 * block, how far through it is, and that block's expected travel time. The engine has no concept
 * of an "arrival board" and doesn't need one — this is the same division of labour
 * `DelayAnalyticsPanel` already follows for delay totals.
 */

export interface StationArrival {
  readonly train: TrainState;
  readonly line: Line | undefined;
  /** Platform this line uses at this station, matching the 3D layout's numbering (line order). */
  readonly platformNumber: number | null;
  /** Seconds until arrival, or 0 if the train is already at the platform. */
  readonly etaSeconds: number;
  readonly atPlatform: boolean;
  /** Where this train ends up — the last station on its line in its direction of travel. */
  readonly destinationName: string;
}

const AT_STATION_STATUSES = new Set(["AT_STATION", "DWELLING"]);

/**
 * Platform numbers follow the order a station's lines appear in the network's line list, which is
 * exactly how `buildStationLayout3D` assigns them. Deriving it the same way here means the number
 * the operator reads on the map matches the platform they see inside the 3D station.
 */
export function platformNumberFor(
  station: Station,
  lines: readonly Line[],
  lineCode: string,
): number | null {
  const serving = lines.filter((line) => station.lines.includes(line.code));
  const index = serving.findIndex((line) => line.code === lineCode);
  return index >= 0 ? index + 1 : null;
}

function destinationName(train: TrainState, line: Line | undefined): string {
  if (!line || line.stations.length === 0) return "—";
  const terminus =
    train.direction === "OUTBOUND" ? line.stations[line.stations.length - 1] : line.stations[0];
  return terminus?.name ?? "—";
}

/**
 * Trains at, or heading directly for, this station — soonest first.
 *
 * "Heading for" means the train's next stop *is* this station, so it is one block away at most.
 * A train two stations out is not an arrival yet; showing it would mean inventing a schedule the
 * engine hasn't committed to.
 */
export function getStationArrivals(
  station: Station,
  trains: readonly TrainState[],
  tracks: readonly Track[],
  lines: readonly Line[],
): StationArrival[] {
  const tracksById = new Map(tracks.map((t) => [t.id, t]));
  const lineByCode = new Map(lines.map((l) => [l.code, l]));

  const arrivals: StationArrival[] = [];

  for (const train of trains) {
    if (train.status === "COMPLETED" || train.status === "SCHEDULED") continue;

    const atPlatform = train.previousStationId === station.id && AT_STATION_STATUSES.has(train.status);
    const inbound = train.nextStationId === station.id;
    if (!atPlatform && !inbound) continue;

    const line = lineByCode.get(train.lineCode);
    const track = train.currentTrackId != null ? tracksById.get(train.currentTrackId) : undefined;
    const remaining = track
      ? Math.max(0, Math.round((1 - train.progress) * track.expectedTravelTimeSeconds))
      : 0;

    arrivals.push({
      train,
      line,
      platformNumber: platformNumberFor(station, lines, train.lineCode),
      etaSeconds: atPlatform ? 0 : remaining,
      atPlatform,
      destinationName: destinationName(train, line),
    });
  }

  return arrivals.sort((a, b) => a.etaSeconds - b.etaSeconds);
}

/** "02:14" — a countdown, so it reads as time-to-arrival rather than a clock time. */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Now";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
