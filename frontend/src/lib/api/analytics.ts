import { trainSimApiClient } from "./client";
import type { AnalyticsRange, AnalyticsResponse } from "@/domain/trainsim/analytics";

export interface AnalyticsQuery {
  range: AnalyticsRange;
  /** ISO-8601 instants — required (and only used) when `range` is `"CUSTOM"`. */
  from?: string | undefined;
  to?: string | undefined;
}

export const analyticsApi = {
  get: ({ range, from, to }: AnalyticsQuery) => {
    const params = new URLSearchParams({ range });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return trainSimApiClient.get<AnalyticsResponse>(`/analytics?${params.toString()}`);
  },
};
