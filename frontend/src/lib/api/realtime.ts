import { realtimeApiClient } from "./client";
import type { MetroStateFrame, RealtimeMode, ServerTime } from "@/domain/realtime";

export const realtimeApi = {
  getState: () => realtimeApiClient.get<MetroStateFrame>("/state"),
  getTime: () => realtimeApiClient.get<ServerTime>("/time"),
  setMode: (mode: RealtimeMode) => realtimeApiClient.post<MetroStateFrame>(`/mode?value=${mode}`),
};
