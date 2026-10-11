import type { MetroStateFrame } from "@/domain/realtime";

/**
 * The freshness numbers the diagnostics panel shows, derived from one canonical frame and the
 * authoritative server time. Pure — the panel re-derives once a second so ages keep counting even
 * when frames stop arriving.
 */
export interface RealtimeDiagnostics {
  readonly trainCount: number;
  /** Positions the active source reported recently (or, for the simulation/timetable, computed now). */
  readonly freshCount: number;
  /** Positions no longer reported by their feed — dead-reckoned estimates. */
  readonly staleCount: number;
  /** Fresh positions advanced or inferred between reports rather than shown exactly as reported. */
  readonly estimatedCount: number;
  /** When the data on screen was last updated at its source (ms epoch), and how. */
  readonly lastUpdateMs: number | null;
  readonly lastUpdateBasis: "OBSERVED" | "COMPUTED";
  readonly dataAgeMs: number | null;
  /** How long ago this frame was built on the server — grows only when frames stop arriving. */
  readonly frameAgeMs: number;
}

export function deriveDiagnostics(frame: MetroStateFrame, serverNowMs: number): RealtimeDiagnostics {
  let staleCount = 0;
  let estimatedCount = 0;
  let newestObservation = Number.NEGATIVE_INFINITY;
  for (const train of frame.trains) {
    if (train.stale) staleCount++;
    else if (train.positionEstimated) estimatedCount++;
    const observed = train.observedAt ? Date.parse(train.observedAt) : Number.NaN;
    if (Number.isFinite(observed) && observed > newestObservation) newestObservation = observed;
  }

  const observedSource = frame.activeSource === "LIVE" || frame.activeSource === "GTFS_REALTIME";
  let lastUpdateMs: number | null;
  if (observedSource) {
    // The newest thing the feed told us: a vehicle's own timestamp, else the last successful fetch.
    const provider = frame.providers.find((p) => p.source === frame.activeSource);
    const lastSuccess = provider?.lastSuccessAt ? Date.parse(provider.lastSuccessAt) : Number.NaN;
    lastUpdateMs = Number.isFinite(newestObservation)
      ? newestObservation
      : Number.isFinite(lastSuccess)
        ? lastSuccess
        : null;
  } else {
    // A simulation tick or a timetable evaluation is computed when the frame is built.
    lastUpdateMs = frame.serverEpochMillis;
  }

  return {
    trainCount: frame.trains.length,
    freshCount: frame.trains.length - staleCount,
    staleCount,
    estimatedCount,
    lastUpdateMs,
    lastUpdateBasis: observedSource ? "OBSERVED" : "COMPUTED",
    dataAgeMs: lastUpdateMs == null ? null : Math.max(0, serverNowMs - lastUpdateMs),
    frameAgeMs: Math.max(0, serverNowMs - frame.serverEpochMillis),
  };
}
