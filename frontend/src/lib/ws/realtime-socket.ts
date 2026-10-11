import { Client, ReconnectionTimeMode, type IMessage } from "@stomp/stompjs";
import { env } from "@/config/env";
import type { MetroStateFrame } from "@/domain/realtime";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeSocketHandlers {
  onFrame: (frame: MetroStateFrame, receivedAtMs: number) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  /** Called after every (re)connect, once subscribed — the place to re-seed over REST, since
   * frames published while disconnected are gone. */
  onConnected?: () => void;
}

const TOPIC = "/topic/realtime/state";

/**
 * STOMP client for the canonical realtime state, independent of React.
 *
 * Reconnects forever with exponential backoff (1s doubling to 30s), so a restarted backend or a
 * flaky network recovers on its own without hammering the server. A frame that fails to parse or
 * lacks the ordering fields is dropped and logged rather than allowed to blank the UI.
 */
export function connectRealtimeSocket(handlers: RealtimeSocketHandlers): () => void {
  const client = new Client({
    brokerURL: toWebSocketUrl(env.wsUrl),
    reconnectDelay: 1000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    maxReconnectDelay: 30_000,
    onConnect: () => {
      handlers.onStatusChange("connected");
      client.subscribe(TOPIC, (message: IMessage) => {
        const receivedAtMs = Date.now();
        const frame = parseFrame(message.body);
        if (frame) handlers.onFrame(frame, receivedAtMs);
      });
      handlers.onConnected?.();
    },
    onWebSocketClose: () => handlers.onStatusChange("disconnected"),
    onWebSocketError: () => handlers.onStatusChange("disconnected"),
    onStompError: (frame) => {
      console.warn("[realtime] STOMP error:", frame.headers.message ?? "unknown");
      handlers.onStatusChange("disconnected");
    },
  });

  handlers.onStatusChange("connecting");
  client.activate();

  return () => {
    void client.deactivate();
  };
}

function parseFrame(body: string): MetroStateFrame | null {
  try {
    const frame = JSON.parse(body) as MetroStateFrame;
    if (typeof frame?.version !== "number" || typeof frame.instanceId !== "string" || !Array.isArray(frame.trains)) {
      console.warn("[realtime] Dropped a frame without version/instanceId/trains");
      return null;
    }
    return frame;
  } catch {
    console.warn("[realtime] Dropped a frame that is not valid JSON");
    return null;
  }
}

function toWebSocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}
