import { Client, type IMessage } from "@stomp/stompjs";
import { env } from "@/config/env";
import type { SimulationState } from "@/domain/trainsim";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface TrainSimulationSocketHandlers {
  onMessage: (state: SimulationState) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

/**
 * Thin wrapper around the STOMP client for `/topic/train-simulation/state`, independent of React.
 * Auto-reconnects on drop. Sibling to `lib/ws/simulation-socket.ts` (the older, separate
 * `/topic/simulation` clock) — kept as its own client rather than generalizing the two, since they
 * carry unrelated message shapes from unrelated backend engines.
 */
export function connectTrainSimulationSocket(handlers: TrainSimulationSocketHandlers): () => void {
  const client = new Client({
    brokerURL: toWebSocketUrl(env.wsUrl),
    reconnectDelay: 3000,
    onConnect: () => {
      handlers.onStatusChange("connected");
      client.subscribe("/topic/train-simulation/state", (frame: IMessage) => {
        handlers.onMessage(JSON.parse(frame.body) as SimulationState);
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
