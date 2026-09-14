import { Client, type IMessage } from "@stomp/stompjs";
import { env } from "@/config/env";
import type { Simulation } from "@/domain";

interface SimulationStateMessage {
  readonly status: Simulation["status"];
  readonly currentTick: number;
  readonly elapsedSimulationMs: number;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface SimulationSocketHandlers {
  onMessage: (message: SimulationStateMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

/**
 * Thin wrapper around the STOMP client, independent of React. Auto-reconnects on drop.
 */
export function connectSimulationSocket(handlers: SimulationSocketHandlers): () => void {
  const client = new Client({
    brokerURL: toWebSocketUrl(env.wsUrl),
    reconnectDelay: 3000,
    onConnect: () => {
      handlers.onStatusChange("connected");
      client.subscribe("/topic/simulation", (frame: IMessage) => {
        handlers.onMessage(JSON.parse(frame.body) as SimulationStateMessage);
      });
    },
    onWebSocketClose: () => handlers.onStatusChange("disconnected"),
    onStompError: () => handlers.onStatusChange("disconnected"),
  });

  handlers.onStatusChange("connecting");
  client.activate();

  return () => {
    void client.deactivate();
  };
}

function toWebSocketUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}
