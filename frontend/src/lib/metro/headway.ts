import type { Line, Station, Track } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import type { Tone } from "@/lib/ui/tone";

/**
 * Observed spacing between consecutive trains on a line and direction.
 *
 * This is a *display-layer* derivation, not a new simulation concept. The engine dispatches on a
 * configured headway but does not publish the gap actually being achieved, so it is reconstructed
 * here from state already on the wire: which block each train is in, and how far through it.
 * Expressing every train's position as cumulative travel time from its line's origin makes the
 * gaps directly comparable, and the difference between adjacent trains is the observed headway.
 *
 * The same class of client-side derivation `DelayAnalyticsPanel` already performs for delay
 * totals. Nothing here is fed back into the engine.
 */

export interface HeadwaySegment {
  readonly line: Line;
  readonly direction: TrainState["direction"];
  /** Observed gaps, in seconds, between each adjacent pair — ordered along the line. */
  readonly gapsSeconds: readonly number[];
  readonly trainCount: number;
  readonly averageSeconds: number;
  /** Largest gap — the one that leaves passengers waiting longest. */
  readonly maxSeconds: number;
  /** Smallest gap — trains bunching. */
  readonly minSeconds: number;
}

/** Gaps this far apart from the line's own average read as uneven service rather than noise. */
const BUNCHING_RATIO = 0.5;
const STRETCHED_RATIO = 1.6;

export function headwayTone(segment: HeadwaySegment): Tone {
  if (segment.trainCount < 3) return "neutral";
  if (segment.maxSeconds > segment.averageSeconds * STRETCHED_RATIO) return "warning";
  if (segment.minSeconds < segment.averageSeconds * BUNCHING_RATIO) return "warning";
  return "positive";
}

/**
 * Cumulative expected travel time from the start of a train's line to its current position.
 *
 * Built from the line's own ordered stations and each track's `expectedTravelTimeSeconds`, so two
 * trains on the same line are always measured against the same ruler.
 */
function progressSeconds(
  train: TrainState,
  line: Line,
  trackByPair: ReadonlyMap<string, Track>,
): number | null {
  const stations = line.stations;
  const index = stations.findIndex((s) => s.id === train.previousStationId);
  if (index < 0) return null;

  let elapsed = 0;
  for (let i = 0; i < index; i += 1) {
    const from = stations[i];
    const to = stations[i + 1];
    if (!from || !to) break;
    elapsed += trackByPair.get(pairKey(from.id, to.id))?.expectedTravelTimeSeconds ?? 0;
  }

  const current = stations[index];
  const next = stations[index + 1];
  if (current && next) {
    const leg = trackByPair.get(pairKey(current.id, next.id))?.expectedTravelTimeSeconds ?? 0;
    elapsed += leg * train.progress;
  }

  return elapsed;
}

function pairKey(a: number, b: number): string {
  // Direction-agnostic: a line's two tracks between the same pair share a travel time.
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function computeHeadways(
  trains: readonly TrainState[],
  lines: readonly Line[],
  tracks: readonly Track[],
): HeadwaySegment[] {
  const trackByPair = new Map<string, Track>();
  for (const track of tracks) {
    trackByPair.set(pairKey(track.fromStationId, track.toStationId), track);
  }

  const segments: HeadwaySegment[] = [];

  for (const line of lines) {
    for (const direction of ["OUTBOUND", "INBOUND"] as const) {
      const active = trains.filter(
        (t) =>
          t.lineCode === line.code &&
          t.direction === direction &&
          t.status !== "SCHEDULED" &&
          t.status !== "COMPLETED",
      );

      const positions = active
        .map((train) => progressSeconds(train, line, trackByPair))
        .filter((p): p is number => p !== null)
        .sort((a, b) => a - b);

      if (positions.length < 2) {
        if (active.length > 0) {
          segments.push({
            line,
            direction,
            gapsSeconds: [],
            trainCount: active.length,
            averageSeconds: 0,
            maxSeconds: 0,
            minSeconds: 0,
          });
        }
        continue;
      }

      const gaps: number[] = [];
      for (let i = 1; i < positions.length; i += 1) {
        gaps.push(Math.round((positions[i] ?? 0) - (positions[i - 1] ?? 0)));
      }

      const total = gaps.reduce((sum, g) => sum + g, 0);
      segments.push({
        line,
        direction,
        gapsSeconds: gaps,
        trainCount: active.length,
        averageSeconds: Math.round(total / gaps.length),
        maxSeconds: Math.max(...gaps),
        minSeconds: Math.min(...gaps),
      });
    }
  }

  return segments;
}

/** Station congestion, ordered worst first — for the operations view's congestion chart. */
export function topCongestedStations(
  queueCounts: ReadonlyMap<number, number>,
  stations: readonly Station[],
  limit: number,
): { station: Station; waiting: number }[] {
  return stations
    .map((station) => ({ station, waiting: queueCounts.get(station.id) ?? 0 }))
    .filter((row) => row.waiting > 0)
    .sort((a, b) => b.waiting - a.waiting)
    .slice(0, limit);
}
