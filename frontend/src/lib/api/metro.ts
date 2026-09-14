import { metroApiClient } from "./client";
import type { Line, MetroNetworkData, Route, Station } from "@/domain/metro";

export const metroApi = {
  getStations: () => metroApiClient.get<Station[]>("/stations"),
  getStation: (id: number) => metroApiClient.get<Station>(`/stations/${id}`),
  getLines: () => metroApiClient.get<Line[]>("/lines"),
  getLine: (id: number) => metroApiClient.get<Line>(`/lines/${id}`),
  getNetwork: () => metroApiClient.get<MetroNetworkData>("/network"),
  getRoute: (fromStationId: number, toStationId: number) =>
    metroApiClient.get<Route>(`/route?from=${fromStationId}&to=${toStationId}`),
};
