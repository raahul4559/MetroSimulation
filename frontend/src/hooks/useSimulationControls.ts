import { useCallback, useState } from "react";
import type { SimulationState } from "@/domain/trainsim";
import { trainSimulationApi } from "@/lib/api/trainSimulation";
import { ApiError } from "@/lib/api/client";

interface SimulationControlsResult {
  isBusy: boolean;
  error: string | null;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  setSpeed: (value: number) => void;
}

/**
 * Transport commands for the simulation engine (`/api/simulation/*`). Deliberately holds no train
 * state: the reply to a command is the simulation's own view, but the UI renders only the canonical
 * realtime state, so `onSettled` asks that store to refresh instead of rendering the reply. One
 * source of truth, even for the frame right after a click.
 */
export function useSimulationControls(onSettled: () => void): SimulationControlsResult {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (action: () => Promise<SimulationState>) => {
      setIsBusy(true);
      setError(null);
      action()
        .then(onSettled)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Action failed."))
        .finally(() => setIsBusy(false));
    },
    [onSettled],
  );

  return {
    isBusy,
    error,
    start: () => run(trainSimulationApi.start),
    pause: () => run(trainSimulationApi.pause),
    stop: () => run(trainSimulationApi.stop),
    reset: () => run(trainSimulationApi.reset),
    setSpeed: (value: number) => run(() => trainSimulationApi.setSpeed(value)),
  };
}
