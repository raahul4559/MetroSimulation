import { useEffect, useState } from "react";
import {
  connectSimulationSocket,
  type ConnectionStatus,
} from "@/lib/ws/simulation-socket";
import type { Simulation } from "@/domain";

export type SimulationTick = Pick<Simulation, "status" | "currentTick" | "elapsedSimulationMs">;

/**
 * Subscribes to the simulation WebSocket topic for the lifetime of the component.
 * `onTick` is called directly from the socket's message callback (not from an effect
 * reacting to state), so callers can safely merge it into their own state.
 */
export function useSimulationSocket(onTick: (tick: SimulationTick) => void): ConnectionStatus {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const disconnect = connectSimulationSocket({
      onStatusChange: setConnectionStatus,
      onMessage: onTick,
    });
    return disconnect;
  }, [onTick]);

  return connectionStatus;
}
