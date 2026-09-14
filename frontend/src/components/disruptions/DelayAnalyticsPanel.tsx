import { useMemo } from "react";
import type { TrainState } from "@/domain/trainsim";

interface DelayAnalyticsPanelProps {
  trains: readonly TrainState[];
}

interface Tile {
  label: string;
  value: string;
}

/** Total/average/max delay, affected trains, and affected passengers — derived client-side from
 * the live train roster already streamed over WS, so it updates every tick with zero extra
 * network round-trips (the backend also exposes `GET /api/simulation/analytics/delays` computing
 * the same numbers, for API completeness/testing). */
export function DelayAnalyticsPanel({ trains }: DelayAnalyticsPanelProps) {
  const tiles = useMemo<Tile[]>(() => {
    const affected = trains.filter((t) => t.delaySeconds > 0);
    const totalDelay = trains.reduce((sum, t) => sum + t.delaySeconds, 0);
    const avgDelay = trains.length === 0 ? 0 : totalDelay / trains.length;
    const maxDelay = trains.reduce((max, t) => Math.max(max, t.delaySeconds), 0);
    const affectedPassengers = affected.reduce((sum, t) => sum + t.passengerCount, 0);

    return [
      { label: "Total delay", value: `${totalDelay}s` },
      { label: "Average delay", value: `${avgDelay.toFixed(0)}s` },
      { label: "Max delay", value: `${maxDelay}s` },
      { label: "Affected trains", value: String(affected.length) },
      { label: "Affected passengers", value: String(affectedPassengers) },
    ];
  }, [trains]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-md bg-slate-800/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">{tile.label}</p>
          <p className="mt-0.5 font-mono text-base text-slate-100">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
