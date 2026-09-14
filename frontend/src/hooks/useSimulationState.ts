import { useCallback, useEffect, useState } from "react";
import type { Simulation } from "@/domain";
import { simulationApi } from "@/lib/api/simulation";
import { ApiError } from "@/lib/api/client";
import { useSimulationSocket, type SimulationTick } from "./useSimulationSocket";
import type { ConnectionStatus } from "@/lib/ws/simulation-socket";

interface SimulationStateResult {
  simulation: Simulation | null;
  connectionStatus: ConnectionStatus;
  isBusy: boolean;
  error: string | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

export function useSimulationState(): SimulationStateResult {
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTick = useCallback((tick: SimulationTick) => {
    setSimulation((prev) => (prev ? { ...prev, ...tick } : prev));
  }, []);
  const connectionStatus = useSimulationSocket(handleTick);

  useEffect(() => {
    let cancelled = false;
    simulationApi
      .getState()
      .then((state) => {
        if (!cancelled) setSimulation(state);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load simulation state.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = useCallback((action: () => Promise<Simulation>) => {
    setIsBusy(true);
    setError(null);
    action()
      .then(setSimulation)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Action failed."))
      .finally(() => setIsBusy(false));
  }, []);

  return {
    simulation,
    connectionStatus,
    isBusy,
    error,
    start: () => runAction(simulationApi.start),
    pause: () => runAction(simulationApi.pause),
    reset: () => runAction(simulationApi.reset),
  };
}
