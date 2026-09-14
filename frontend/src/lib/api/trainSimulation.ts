import { trainSimApiClient } from "./client";
import type { SimulationClock, SimulationState } from "@/domain/trainsim";

export const trainSimulationApi = {
  getState: () => trainSimApiClient.get<SimulationState>("/state"),
  getTime: () => trainSimApiClient.get<SimulationClock>("/time"),
  start: () => trainSimApiClient.post<SimulationState>("/start"),
  pause: () => trainSimApiClient.post<SimulationState>("/pause"),
  stop: () => trainSimApiClient.post<SimulationState>("/stop"),
  reset: () => trainSimApiClient.post<SimulationState>("/reset"),
  setSpeed: (value: number) => trainSimApiClient.post<SimulationState>(`/speed?value=${value}`),
};
