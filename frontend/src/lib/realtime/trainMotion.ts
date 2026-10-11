import type { Line, Track } from "@/domain/metro";
import type { TrainState, TrainStatus } from "@/domain/trainsim";

/**
 * Smooth motion between canonical frames — the ONE animation system for trains. The 2D marker and
 * the 3D train both ask this store where a train is *right now*; neither animates on its own.
 *
 * It never invents movement. Every frame's canonical train state (already placed on the track graph
 * by the backend: leg + progress) is a keyframe, and the store only blends from where the train is
 * currently drawn to the newest keyframe, over the interval the server says elapsed between frames
 * (`serverEpochMillis` deltas — timestamp-aware, not a per-render-frame lerp). The display therefore
 * trails the canonical state by at most one frame interval and lands exactly on it.
 *
 * Constrained to the track: positions are blended as a scalar along the line's station sequence
 * (station index + progress along the leg), then decoded back to a leg of the track graph — so a
 * train crossing a station in mid-blend follows the line through that station, never a chord
 * across it.
 *
 * It snaps instead of blending whenever a blend would misrepresent: a new train, a line or
 * direction change (a new trip), a jump of several legs, a large backwards correction from a feed,
 * a long gap between frames, or reduced-motion preference.
 *
 * Plain class, no React: the map's and the 3D scene's animation loops call `sample` every display
 * frame without causing a single React render.
 */

/** Blends longer than this many legs are snapped: the train genuinely moved far (fast-forward,
 * feed catch-up), and gliding it across the map would be a fiction. */
const MAX_BLEND_LEGS = 2.5;
/** Feeds correct themselves backwards (extrapolation overshoot); small corrections glide, larger
 * ones snap so the train is never seen reversing along the line. */
const MAX_BACKTRACK_LEGS = 0.3;
const MIN_BLEND_MS = 100;
/** A gap longer than this between frames means the stream stalled; don't glide across it. */
const MAX_BLEND_MS = 3_000;
const AT_STATION_EPSILON = 1e-4;

const STATIONARY: ReadonlySet<TrainStatus> = new Set(["SCHEDULED", "AT_STATION", "DWELLING", "COMPLETED"]);

export interface TrackPosition {
  readonly previousStationId: number;
  readonly nextStationId: number;
  readonly progress: number;
  readonly currentTrackId: number | null;
}

interface LineAxis {
  readonly stationIds: readonly number[];
  readonly indexById: ReadonlyMap<number, number>;
}

interface Entry {
  target: TrainState;
  /** Scalar position along the line's station sequence; null when the train can't be placed on an
   * axis (unknown line/leg) — such a train is always drawn exactly at its canonical state. */
  fromX: number | null;
  toX: number | null;
  startMs: number;
  durationMs: number;
}

export class TrainMotionStore {
  private axes = new Map<string, LineAxis>();
  private trackByPair = new Map<string, number>();
  private entries = new Map<number, Entry>();
  private lastFrameServerMs: number | null = null;
  private animatingUntilMs = 0;
  private reducedMotion = false;
  private revisionCount = 0;

  /** Increments whenever what `sample` returns may have changed without a blend (a snap, a new or
   * removed train, a network change) — render loops redraw when it moves. */
  get revision(): number {
    return this.revisionCount;
  }

  setNetwork(lines: readonly Line[], tracks: readonly Track[]): void {
    this.axes = new Map(
      lines.map((line) => {
        const stationIds = line.stations.map((s) => s.id);
        return [line.code, { stationIds, indexById: new Map(stationIds.map((id, i) => [id, i])) }];
      }),
    );
    this.trackByPair = new Map(tracks.map((t) => [pairKey(t.fromStationId, t.toStationId), t.id]));
    this.revisionCount++;
    // Existing entries were placed on the old axes; start them fresh.
    for (const entry of this.entries.values()) {
      entry.fromX = entry.toX = this.toAxis(entry.target);
      entry.durationMs = 0;
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /**
   * Takes one canonical frame. `frameServerMs` is the frame's server timestamp; `nowMs` is the
   * local monotonic clock (`performance.now()`) the same caller will pass to {@link sample}.
   */
  ingest(trains: readonly TrainState[], frameServerMs: number, nowMs: number): void {
    // The same frame twice (REST seed racing the socket, a StrictMode double effect) is a no-op —
    // re-ingesting it would read as a zero-length interval and snap an in-progress blend.
    if (frameServerMs === this.lastFrameServerMs) return;
    const interval = this.lastFrameServerMs == null ? null : frameServerMs - this.lastFrameServerMs;
    this.lastFrameServerMs = frameServerMs;
    const canBlend = !this.reducedMotion && interval != null && interval > 0 && interval <= MAX_BLEND_MS;
    const durationMs = canBlend ? Math.max(MIN_BLEND_MS, interval) : 0;

    const next = new Map<number, Entry>();
    for (const train of trains) {
      const targetX = this.toAxis(train);
      const previous = this.entries.get(train.id);
      let fromX = targetX;

      if (canBlend && previous && targetX != null && this.sameRun(previous.target, train)) {
        const currentX = this.xAt(previous, nowMs);
        if (currentX != null) {
          const forward = (targetX - currentX) * directionSign(train);
          if (Math.abs(targetX - currentX) <= MAX_BLEND_LEGS && forward >= -MAX_BACKTRACK_LEGS) {
            fromX = currentX;
          }
        }
      }

      next.set(train.id, { target: train, fromX, toX: targetX, startMs: nowMs, durationMs: fromX === targetX ? 0 : durationMs });
    }
    this.entries = next;
    this.revisionCount++;
    this.animatingUntilMs = durationMs > 0 ? nowMs + durationMs : nowMs;
  }

  /** True while any train is mid-blend — render loops skip work when nothing is moving. */
  isAnimating(nowMs: number): boolean {
    return nowMs < this.animatingUntilMs;
  }

  /** The train as it should be drawn at `nowMs`: its canonical state with the position fields
   * (leg, progress, track) blended, and a status consistent with that position. Every other field
   * — delay, ETA, source, observedAt, speed — is the canonical value, untouched. */
  sample(trainId: number, nowMs: number): TrainState | null {
    const entry = this.entries.get(trainId);
    if (!entry) return null;
    return this.sampleEntry(entry, nowMs);
  }

  /** Same as {@link sample} for a train object the caller already holds (falls back to it as-is
   * when the store hasn't seen this train yet). */
  sampleTrain(train: TrainState, nowMs: number): TrainState {
    const entry = this.entries.get(train.id);
    return entry ? this.sampleEntry(entry, nowMs) : train;
  }

  private sampleEntry(entry: Entry, nowMs: number): TrainState {
    const { target } = entry;
    if (entry.toX == null || entry.fromX == null || entry.durationMs === 0 || nowMs >= entry.startMs + entry.durationMs) {
      return target;
    }
    const x = this.xAt(entry, nowMs);
    const axis = this.axes.get(target.lineCode);
    if (x == null || !axis) return target;
    const position = this.fromAxis(axis, x, directionSign(target));
    if (!position) return target;
    return { ...target, ...position, status: blendedStatus(position, target) };
  }

  private xAt(entry: Entry, nowMs: number): number | null {
    if (entry.fromX == null || entry.toX == null) return null;
    if (entry.durationMs === 0) return entry.toX;
    const t = Math.min(1, Math.max(0, (nowMs - entry.startMs) / entry.durationMs));
    return entry.fromX + (entry.toX - entry.fromX) * t;
  }

  private sameRun(a: TrainState, b: TrainState): boolean {
    return a.lineCode === b.lineCode && a.direction === b.direction;
  }

  /** Station index + progress along the leg, or null if the leg isn't two adjacent stations of
   * this train's line. */
  toAxis(train: Pick<TrainState, "lineCode" | "previousStationId" | "nextStationId" | "progress">): number | null {
    const axis = this.axes.get(train.lineCode);
    if (!axis) return null;
    const from = axis.indexById.get(train.previousStationId);
    if (from == null) return null;
    if (train.previousStationId === train.nextStationId) return from;
    const to = axis.indexById.get(train.nextStationId);
    if (to == null || Math.abs(to - from) !== 1) return null;
    return from + (to - from) * clamp01(train.progress);
  }

  private fromAxis(axis: LineAxis, x: number, sign: 1 | -1): TrackPosition | null {
    const nearest = Math.round(x);
    if (Math.abs(x - nearest) < AT_STATION_EPSILON) {
      const id = axis.stationIds[nearest];
      return id == null ? null : { previousStationId: id, nextStationId: id, progress: 0, currentTrackId: null };
    }
    const fromIndex = sign > 0 ? Math.floor(x) : Math.ceil(x);
    const toIndex = fromIndex + sign;
    const previousStationId = axis.stationIds[fromIndex];
    const nextStationId = axis.stationIds[toIndex];
    if (previousStationId == null || nextStationId == null) return null;
    return {
      previousStationId,
      nextStationId,
      progress: Math.abs(x - fromIndex),
      currentTrackId: this.trackByPair.get(pairKey(previousStationId, nextStationId)) ?? null,
    };
  }
}

/** A status that agrees with the blended position. On the target's own leg (or platform) it is the
 * target's status; while still catching up toward a platform stop it is ARRIVING; leaving the
 * station it was standing at, DEPARTING; anywhere else on the way, RUNNING. */
function blendedStatus(position: TrackPosition, target: TrainState): TrainStatus {
  const sameLeg =
    position.previousStationId === target.previousStationId && position.nextStationId === target.nextStationId;
  if (sameLeg) return target.status;
  if (position.previousStationId === position.nextStationId) {
    return position.previousStationId === target.previousStationId ? "DEPARTING" : "RUNNING";
  }
  if (STATIONARY.has(target.status) && target.previousStationId === position.nextStationId) return "ARRIVING";
  return "RUNNING";
}

/** OUTBOUND runs along the line's station order (index increasing), INBOUND against it — the same
 * convention the backend's route builder and the 3D destination lookup use. */
function directionSign(train: Pick<TrainState, "direction">): 1 | -1 {
  return train.direction === "OUTBOUND" ? 1 : -1;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
