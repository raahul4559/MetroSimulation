import { apiClient } from "./client";
import type { Simulation } from "@/domain";

export const simulationApi = {
  getState: () => apiClient.get<Simulation>("/simulation"),
  start: () => apiClient.post<Simulation>("/simulation/start"),
  pause: () => apiClient.post<Simulation>("/simulation/pause"),
  reset: () => apiClient.post<Simulation>("/simulation/reset"),
};
