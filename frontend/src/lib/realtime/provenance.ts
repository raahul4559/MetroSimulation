import type { DataSource, MetroStateFrame } from "@/domain/realtime";
import type { TrainState } from "@/domain/trainsim";
import type { ConnectionStatus } from "@/lib/ws/realtime-socket";
import type { Tone } from "@/lib/ui/tone";

/**
 * The one place a data-source label is decided. Every badge, card and overlay asks here, so the
 * rule cannot drift: the word "Live" appears only when the server says the frame is live (an
 * observed source that is fresh) AND this browser is still receiving frames. A healthy socket
 * delivering a simulation or a timetable estimate is never "Live".
 */

export interface FeedProvenance {
  readonly source: DataSource | null;
  readonly isLive: boolean;
  readonly label: string;
  readonly tone: Tone;
  /** Longer explanation, for a tooltip/title — why this source, and how fresh. */
  readonly detail: string;
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  LIVE: "Live",
  GTFS_REALTIME: "Realtime (GTFS-RT)",
  SCHEDULE: "Timetable estimate",
  SIMULATION: "Simulation",
};

const SOURCE_SHORT: Record<DataSource, string> = {
  LIVE: "Live",
  GTFS_REALTIME: "GTFS-RT",
  SCHEDULE: "Scheduled",
  SIMULATION: "Simulated",
};

export function describeFeed(
  frame: MetroStateFrame | null,
  connection: ConnectionStatus,
  stalled: boolean,
): FeedProvenance {
  if (!frame) {
    return connection === "disconnected"
      ? { source: null, isLive: false, label: "Disconnected", tone: "danger", detail: "Cannot reach the backend." }
      : { source: null, isLive: false, label: "Connecting…", tone: "warning", detail: "Waiting for the first state." };
  }

  const source = frame.activeSource;
  const observed = source === "LIVE" || source === "GTFS_REALTIME";
  const frozen = connection === "disconnected" || stalled;

  if (frozen) {
    return {
      source,
      isLive: false,
      label: connection === "disconnected" ? "Disconnected · last known" : "No updates · last known",
      tone: "danger",
      detail: `Showing the last state received (${SOURCE_LABEL[source].toLowerCase()}). ${frame.sourceReason}`,
    };
  }
  if (observed && (frame.activeSourceStale || !frame.isLive)) {
    return {
      source,
      isLive: false,
      label: source === "LIVE" ? "Live feed stale" : "GTFS-RT stale",
      tone: "warning",
      detail: frame.sourceReason,
    };
  }
  if (frame.isLive) {
    return { source, isLive: true, label: SOURCE_LABEL[source], tone: "positive", detail: frame.sourceReason };
  }
  return {
    source,
    isLive: false,
    label: SOURCE_LABEL[source],
    tone: source === "SCHEDULE" ? "info" : "neutral",
    detail: frame.sourceReason,
  };
}

/** A compact per-train provenance tag, e.g. "Simulated", "GTFS-RT · stale", "Scheduled". */
export function trainSourceLabel(
  train: Pick<TrainState, "source" | "stale"> & Partial<Pick<TrainState, "positionEstimated">>,
): string {
  const base = SOURCE_SHORT[train.source];
  if (train.stale) return `${base} · stale`;
  if (train.positionEstimated && (train.source === "LIVE" || train.source === "GTFS_REALTIME")) {
    return `${base} · estimated position`;
  }
  return base;
}

export function trainSourceTone(train: Pick<TrainState, "source" | "stale">): Tone {
  if (train.stale) return "warning";
  if (train.source === "LIVE" || train.source === "GTFS_REALTIME") return "positive";
  return train.source === "SCHEDULE" ? "info" : "neutral";
}
