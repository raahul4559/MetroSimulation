import { realtimeApiClient } from "./client";
import type { MetroStateFrame, RealtimeMode, ServerTime, ServiceStatus } from "@/domain/realtime";

export const realtimeApi = {
  getState: () => realtimeApiClient.get<MetroStateFrame>("/state"),
  getTime: () => realtimeApiClient.get<ServerTime>("/time"),
  getServiceStatus: () => realtimeApiClient.get<ServiceStatus>("/service-status"),
  setMode: (mode: RealtimeMode) => realtimeApiClient.post<MetroStateFrame>(`/mode?value=${mode}`),
};
