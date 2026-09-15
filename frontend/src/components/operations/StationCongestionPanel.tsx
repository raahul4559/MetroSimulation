"use client";

import { useMemo } from "react";
import type { Station } from "@/domain/metro";
import type { Passenger } from "@/domain/trainsim";
import {
  DENSITY_COLOR,
  buildStationQueueCounts,
  densityLevel,
} from "@/lib/metro/passengerDisplay";
import { topCongestedStations } from "@/lib/metro/headway";
import { BarChart } from "@/components/charts/BarChart";

interface StationCongestionPanelProps {
  passengers: readonly Passenger[];
  stations: readonly Station[];
  limit?: number;
}

/** Where passengers are actually piling up, worst first — derived from the live passenger roster
 * with the same `buildStationQueueCounts` the map's density halos use, so the chart and the map
 * can never disagree about which station is busiest. */
export function StationCongestionPanel({
  passengers,
  stations,
  limit = 10,
}: StationCongestionPanelProps) {
  const data = useMemo(() => {
    const counts = buildStationQueueCounts(passengers);
    return topCongestedStations(counts, stations, limit).map(({ station, waiting }) => ({
      key: String(station.id),
      label: station.name,
      value: waiting,
      color: DENSITY_COLOR[densityLevel(waiting)],
    }));
  }, [passengers, stations, limit]);

  if (data.length === 0) {
    return <p className="text-xs text-muted">No passengers waiting anywhere on the network.</p>;
  }

  return <BarChart data={data} orientation="horizontal" />;
}
