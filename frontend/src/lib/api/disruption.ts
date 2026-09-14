import { trainSimApiClient } from "./client";
import type { CreateDisruptionRequest, Disruption, DisruptionAnalytics } from "@/domain/trainsim";

export const disruptionApi = {
  list: () => trainSimApiClient.get<Disruption[]>("/disruptions"),
  create: (request: CreateDisruptionRequest) =>
    trainSimApiClient.post<Disruption>("/disruptions", request),
  cancel: (id: number) => trainSimApiClient.del<void>(`/disruptions/${id}`),
  getAnalytics: () => trainSimApiClient.get<DisruptionAnalytics>("/analytics/delays"),
};
