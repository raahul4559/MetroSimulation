import { useCallback, useEffect, useState } from "react";
import type { SimulationState } from "@/domain/trainsim";
import { trainSimulationApi } from "@/lib/api/trainSimulation";
import { ApiError } from "@/lib/api/client";
import { useTrainSimulationSocket } from "./useTrainSimulationSocket";
import type { ConnectionStatus } from "@/lib/ws/train-simulation-socket";

interface TrainSimulationResult {
  state: SimulationState | null;
  connectionStatus: ConnectionStatus;
  isBusy: boolean;
  error: string | null;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  setSpeed: (value: number) => void;
}

/** Bridges the discrete-time train simulation engine (`/api/simulation`, `/topic/train-simulation/state`)
 * into React state — the trainsim analogue of `useSimulationState` for the legacy clock. */
export function useTrainSimulation(): TrainSimulationResult {
  const [state, setState] = useState<SimulationState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMessage = useCallback((next: SimulationState) => setState(next), []);
  const connectionStatus = useTrainSimulationSocket(handleMessage);

  useEffect(() => {
    let cancelled = false;
    trainSimulationApi
      .getState()
      .then((initial) => {
        if (!cancelled) setState(initial);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load train simulation state.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = useCallback((action: () => Promise<SimulationState>) => {
    setIsBusy(true);
    setError(null);
    action()
      .then(setState)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Action failed."))
      .finally(() => setIsBusy(false));
  }, []);

  return {
    state,
    connectionStatus,
    isBusy,
    error,
    start: () => runAction(trainSimulationApi.start),
    pause: () => runAction(trainSimulationApi.pause),
    stop: () => runAction(trainSimulationApi.stop),
    reset: () => runAction(trainSimulationApi.reset),
    setSpeed: (value: number) => runAction(() => trainSimulationApi.setSpeed(value)),
  };
}
