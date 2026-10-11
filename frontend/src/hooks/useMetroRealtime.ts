import { useCallback, useEffect, useRef, useState } from "react";
import type { MetroStateFrame } from "@/domain/realtime";
import { realtimeApi } from "@/lib/api/realtime";
import { ApiError } from "@/lib/api/client";
import { connectRealtimeSocket, type ConnectionStatus } from "@/lib/ws/realtime-socket";
import { localNowMs, recordServerTime } from "@/lib/realtime/serverClock";

/** The backend publishes at least once a second; this long without a frame means the feed to this
 * browser has stalled even if the socket still claims to be open. */
export const FRAME_STALL_MS = 5_000;

export interface MetroRealtimeResult {
  readonly frame: MetroStateFrame | null;
  readonly connectionStatus: ConnectionStatus;
  /** No frame for {@link FRAME_STALL_MS}: what's on screen is frozen. */
  readonly stalled: boolean;
  readonly error: string | null;
  /** Successful reconnects since the page loaded (the first connect doesn't count). */
  readonly reconnectCount: number;
  /** When this browser last accepted a frame ({@link localNowMs} clock), or null before the first. */
  readonly lastFrameReceivedAtMs: number | null;
  /** Fetch the current state now, e.g. right after a control command. */
  readonly refresh: () => void;
}

/**
 * The frontend store's single input: the canonical `MetroStateFrame`, seeded over REST and then
 * streamed on `/topic/realtime/state`.
 *
 * Ordering: frames carry `(instanceId, version)`. A frame from the same backend instance with a
 * version not newer than the one shown is discarded (a slow REST seed must not overwrite a newer
 * socket frame); a different instance id means the backend restarted, and is accepted.
 *
 * Every accepted frame also feeds the server-clock offset, so the browser shows server time.
 */
export function useMetroRealtime(): MetroRealtimeResult {
  const [frame, setFrame] = useState<MetroStateFrame | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastFrameReceivedAtMs, setLastFrameReceivedAtMs] = useState<number | null>(null);
  const connectedOnce = useRef(false);
  const latest = useRef<MetroStateFrame | null>(null);
  const lastFrameAt = useRef(0);

  const accept = useCallback((next: MetroStateFrame, receivedAtMs: number) => {
    const current = latest.current;
    if (current && current.instanceId === next.instanceId && next.version <= current.version) return;
    if (current && current.instanceId !== next.instanceId) {
      console.info("[realtime] Backend instance changed; resynchronising");
    }
    latest.current = next;
    lastFrameAt.current = receivedAtMs;
    recordServerTime(next.serverEpochMillis, receivedAtMs);
    setFrame(next);
    setLastFrameReceivedAtMs(receivedAtMs);
    setStalled(false);
    setError(null);
  }, []);

  const refresh = useCallback(() => {
    const requestedAt = localNowMs();
    realtimeApi
      .getState()
      .then((state) => {
        // Over REST the response could have been stamped any time during the round trip; the
        // midpoint is the fair receive time for clock-offset purposes.
        accept(state, (requestedAt + localNowMs()) / 2);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load the metro state.");
      });
  }, [accept]);

  useEffect(() => {
    refresh();
    return connectRealtimeSocket({
      onStatusChange: setConnectionStatus,
      onFrame: accept,
      // Anything published while we were disconnected is gone — re-seed rather than wait.
      onConnected: () => {
        if (connectedOnce.current) {
          console.info("[realtime] Reconnected; re-seeding state");
          setReconnectCount((n) => n + 1);
        }
        connectedOnce.current = true;
        refresh();
      },
    });
  }, [accept, refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const isStalled = lastFrameAt.current > 0 && localNowMs() - lastFrameAt.current > FRAME_STALL_MS;
      setStalled((was) => {
        if (isStalled && !was) console.warn(`[realtime] No state frame for ${FRAME_STALL_MS / 1000}s`);
        return isStalled;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return { frame, connectionStatus, stalled, error, reconnectCount, lastFrameReceivedAtMs, refresh };
}
