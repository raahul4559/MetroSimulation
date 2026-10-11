import type { MetroStateFrame } from "@/domain/realtime";
import type { TrainState } from "@/domain/trainsim";
import type { ConnectionStatus } from "@/lib/ws/realtime-socket";
import type { Tone } from "@/lib/ui/tone";
import { deriveDiagnostics } from "./diagnostics";
import { formatAge } from "./provenance";

/**
 * The data-state badge every realtime-dependent component carries: one word for what the data is
 * and one line for how far to trust it.
 *
 *   ● LIVE        Updated 6s ago
 *   ● ESTIMATED   Based on schedule
 *   ● OFFLINE     Realtime feed unavailable
 *
 * Built on the same rules as `describeFeed` — LIVE only when the server says the frame is live (an
 * observed source, fresh) AND this browser is still receiving frames. A healthy socket delivering
 * the simulation or a timetable estimate is never LIVE.
 */
export type DataStateKind =
  /** An authorized feed or GTFS-Realtime, fresh, and frames still arriving. */
  | "LIVE"
  /** Positions inferred from the timetable, or interpolated from an observed feed. */
  | "ESTIMATED"
  /** An observed feed that has stopped reporting; positions are dead-reckoned. */
  | "STALE"
  /** The simulation is the source — not real trains. */
  | "SIMULATED"
  /** No frames reaching this browser; anything shown is the last state received. */
  | "OFFLINE"
  /** Before the first frame. */
  | "CONNECTING"
  /** The active source does not report this kind of data at all. */
  | "UNAVAILABLE";

export interface DataState {
  readonly kind: DataStateKind;
  /** The badge word, e.g. "LIVE". */
  readonly label: string;
  /** The second line, e.g. "Updated 6s ago". */
  readonly caption: string;
  readonly tone: Tone;
  /** Longer explanation for a tooltip. */
  readonly detail: string;
}

const TONE: Record<DataStateKind, Tone> = {
  LIVE: "positive",
  ESTIMATED: "info",
  STALE: "warning",
  SIMULATED: "neutral",
  OFFLINE: "danger",
  CONNECTING: "warning",
  UNAVAILABLE: "neutral",
};

function state(kind: DataStateKind, caption: string, detail: string): DataState {
  return { kind, label: kind, caption, tone: TONE[kind], detail };
}

function isObserved(source: string): boolean {
  return source === "LIVE" || source === "GTFS_REALTIME";
}

/** An observed provider that is configured but not delivering — the reason a fallback is active. */
function failedFeed(frame: MetroStateFrame): string | null {
  const failed = frame.providers.find(
    (p) => isObserved(p.source) && (p.status === "ERROR" || p.status === "STALE"),
  );
  return failed ? failed.name : null;
}

/**
 * The network-level state: what the trains on screen are, as a whole. `serverNowMs` is the
 * authoritative clock (it keeps ticking when frames stop, so an offline age keeps growing).
 */
export function describeDataState(
  frame: MetroStateFrame | null,
  connection: ConnectionStatus,
  stalled: boolean,
  serverNowMs: number,
): DataState {
  if (!frame) {
    return connection === "disconnected"
      ? state("OFFLINE", "Realtime feed unavailable", "Cannot reach the backend; reconnecting automatically.")
      : state("CONNECTING", "Connecting to realtime feed", "Waiting for the first state from the backend.");
  }

  const { dataAgeMs, frameAgeMs } = deriveDiagnostics(frame, serverNowMs);

  if (connection === "disconnected" || stalled) {
    return state(
      "OFFLINE",
      `Realtime feed unavailable · last update ${formatAge(frameAgeMs)} ago`,
      `No state is reaching this browser; showing the last one received. ${frame.sourceReason}`,
    );
  }

  const source = frame.activeSource;
  if (isObserved(source)) {
    if (frame.isLive && !frame.activeSourceStale) {
      return state("LIVE", `Updated ${formatAge(dataAgeMs ?? 0)} ago`, frame.sourceReason);
    }
    return state(
      "STALE",
      dataAgeMs == null ? "Feed stopped reporting · estimated" : `Last report ${formatAge(dataAgeMs)} ago · estimated`,
      frame.sourceReason,
    );
  }

  const failed = failedFeed(frame);
  if (source === "SCHEDULE") {
    return state(
      "ESTIMATED",
      failed ? "Realtime feed unavailable · based on schedule" : "Based on schedule",
      frame.sourceReason,
    );
  }
  return state(
    "SIMULATED",
    failed ? "Realtime feed unavailable · simulation" : "Simulation · not real trains",
    frame.sourceReason,
  );
}

/**
 * One train's state, for a train card or the 3D station. Never better than the network's: an
 * offline browser makes every train offline, and a train is LIVE only inside a live frame.
 */
export function describeTrainDataState(
  train: Pick<TrainState, "source" | "stale" | "positionEstimated" | "observedAt">,
  network: DataState,
  serverNowMs: number,
): DataState {
  if (network.kind === "OFFLINE" || network.kind === "CONNECTING") return network;

  const observedAt = train.observedAt ? Date.parse(train.observedAt) : Number.NaN;
  const age = Number.isFinite(observedAt) ? formatAge(serverNowMs - observedAt) : null;

  switch (train.source) {
    case "SIMULATION":
      return state("SIMULATED", "Simulation · not a real train", "Position computed by the simulation.");
    case "SCHEDULE":
      return state("ESTIMATED", "Based on schedule", "Position inferred from the published timetable.");
    case "LIVE":
    case "GTFS_REALTIME":
      if (train.stale) {
        return state(
          "STALE",
          age ? `Last report ${age} ago · estimated` : "No recent report · estimated",
          "This train is no longer being reported; its position is dead-reckoned from the last fix.",
        );
      }
      if (network.kind !== "LIVE") {
        return state("ESTIMATED", age ? `Reported ${age} ago` : "Not currently live", network.detail);
      }
      if (train.positionEstimated) {
        return state(
          "ESTIMATED",
          age ? `Interpolated · reported ${age} ago` : "Interpolated position",
          "Reported by the feed; the position is advanced between reports.",
        );
      }
      return state("LIVE", age ? `Updated ${age} ago` : "Updated just now", "Reported by the realtime feed.");
  }
}

/**
 * Passenger counts, queues and injected disruptions exist only inside the simulation. Under any
 * other source those panels are empty because nothing reports them — not because there are none.
 */
export function simulationOnlyDataState(network: DataState, isSimulationSource: boolean): DataState {
  if (network.kind === "OFFLINE" || network.kind === "CONNECTING") return network;
  if (isSimulationSource) return network;
  return state("UNAVAILABLE", "Not reported by this source", "Only the simulation models passengers and disruptions.");
}

/**
 * Delay figures: only some sources know them. A timetable estimate has no delays, which is not the
 * same as every train being on time.
 */
export function delayDataState(network: DataState, knownDelayCount: number, trainCount: number): DataState {
  if (network.kind === "OFFLINE" || network.kind === "CONNECTING") return network;
  if (trainCount > 0 && knownDelayCount === 0) {
    return state("UNAVAILABLE", "Delays not reported by this source", "The active source gives no delay information.");
  }
  return network;
}
