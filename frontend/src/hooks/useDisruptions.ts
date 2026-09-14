import { useCallback, useState } from "react";
import type { CreateDisruptionRequest } from "@/domain/trainsim";
import { disruptionApi } from "@/lib/api/disruption";
import { ApiError } from "@/lib/api/client";

interface DisruptionActionsResult {
  isBusy: boolean;
  error: string | null;
  create: (request: CreateDisruptionRequest) => void;
  cancel: (id: number) => void;
}

/** Create/cancel actions for disruptions. The disruption list itself is read straight off the live
 * `SimulationState` (already streamed over WS via `useTrainSimulation`) rather than fetched here —
 * this hook only needs to trigger the two mutations and surface busy/error state for the form. */
export function useDisruptions(): DisruptionActionsResult {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback((action: () => Promise<unknown>) => {
    setIsBusy(true);
    setError(null);
    action()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Action failed."))
      .finally(() => setIsBusy(false));
  }, []);

  return {
    isBusy,
    error,
    create: (request: CreateDisruptionRequest) => runAction(() => disruptionApi.create(request)),
    cancel: (id: number) => runAction(() => disruptionApi.cancel(id)),
  };
}
