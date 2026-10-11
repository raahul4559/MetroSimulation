import { realtimeApi } from "@/lib/api/realtime";
import { localNowMs, recordServerTime, serverClockNeedsSync } from "./serverClock";

let inFlight: Promise<void> | null = null;

/**
 * Syncs the server clock over REST (`GET /api/realtime/time`) when no recent sample exists — i.e.
 * on pages that don't hold the realtime stream (/stations, /analytics), or after a long gap. Live
 * pages are synced continuously by every state frame and never call out here. At most one request
 * at a time; failures are left for the next tick (the clock keeps running on the last offset).
 */
export function syncServerClockIfNeeded(): void {
  if (inFlight || !serverClockNeedsSync()) return;
  const requestedAt = localNowMs();
  inFlight = realtimeApi
    .getTime()
    .then((time) => recordServerTime(time.serverEpochMillis, (requestedAt + localNowMs()) / 2))
    .catch(() => {
      // Backend unreachable: keep the last known offset (or the local clock) rather than fail.
    })
    .finally(() => {
      inFlight = null;
    });
}
