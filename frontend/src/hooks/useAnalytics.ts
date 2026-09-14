import { useCallback, useEffect, useState } from "react";
import { analyticsApi } from "@/lib/api/analytics";
import { ApiError } from "@/lib/api/client";
import type { AnalyticsRange, AnalyticsResponse } from "@/domain/trainsim/analytics";

const POLL_INTERVAL_MS = 5000;

interface UseAnalyticsResult {
  data: AnalyticsResponse | null;
  isLoading: boolean;
  error: string | null;
}

/** Polls `GET /api/simulation/analytics` on an interval — analytics is a computed snapshot, not a
 * websocket-pushed stream like train positions, so a short poll is what keeps the dashboard's LIVE
 * section current without needing a dedicated push channel for it. Refetches immediately whenever
 * the requested range changes. */
export function useAnalytics(range: AnalyticsRange, customFrom?: string, customTo?: string): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(
    (signal: { cancelled: boolean }) => {
      if (range === "CUSTOM" && (!customFrom || !customTo)) {
        return;
      }
      analyticsApi
        .get({ range, from: customFrom, to: customTo })
        .then((next) => {
          if (!signal.cancelled) {
            setData(next);
            setError(null);
          }
        })
        .catch((err) => {
          if (!signal.cancelled) {
            setError(err instanceof ApiError ? err.message : "Failed to load analytics.");
          }
        })
        .finally(() => {
          if (!signal.cancelled) setIsLoading(false);
        });
    },
    [range, customFrom, customTo]
  );

  useEffect(() => {
    const signal = { cancelled: false };
    setIsLoading(true);
    fetchOnce(signal);
    const interval = setInterval(() => fetchOnce(signal), POLL_INTERVAL_MS);
    return () => {
      signal.cancelled = true;
      clearInterval(interval);
    };
  }, [fetchOnce]);

  return { data, isLoading, error };
}
