import { useEffect, useState } from "react";
import {
  connectTrainSimulationSocket,
  type ConnectionStatus,
} from "@/lib/ws/train-simulation-socket";
import type { SimulationState } from "@/domain/trainsim";

/**
 * Subscribes to `/topic/train-simulation/state` for the lifetime of the component. `onState` is
 * called directly from the socket's message callback (not from an effect reacting to state), so
 * callers can safely merge it into their own state.
 */
export function useTrainSimulationSocket(onState: (state: SimulationState) => void): ConnectionStatus {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const disconnect = connectTrainSimulationSocket({
      onStatusChange: setConnectionStatus,
      onMessage: onState,
    });
    return disconnect;
  }, [onState]);

  return connectionStatus;
}
