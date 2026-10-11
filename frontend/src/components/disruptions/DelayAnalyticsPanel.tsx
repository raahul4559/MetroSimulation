import { useMemo } from "react";
import type { TrainState } from "@/domain/trainsim";
import { Metric } from "@/components/ui/Metric";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { delayStats, isLate } from "@/lib/metro/trainDisplay";
import type { Tone } from "@/lib/ui/tone";

interface DelayAnalyticsPanelProps {
  trains: readonly TrainState[];
  columns?: 2 | 3 | 5;
}

interface Tile {
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
}

/** Thresholds for how bad a delay is, in seconds of the worst-delayed train. Named here rather
 * than inlined in the markup so "what counts as a bad delay" is one decision, not a ternary. */
const MAX_DELAY_WARNING_SECONDS = 60;
const MAX_DELAY_CRITICAL_SECONDS = 120;

function maxDelayTone(seconds: number): Tone {
  if (seconds >= MAX_DELAY_CRITICAL_SECONDS) return "danger";
  if (seconds >= MAX_DELAY_WARNING_SECONDS) return "warning";
  return "neutral";
}

/** Total/average/max delay, affected trains, and affected passengers — derived client-side from
 * the live train roster already streamed over WS, so it updates every tick with zero extra
 * network round-trips (the backend also exposes `GET /api/simulation/analytics/delays` computing
 * the same numbers, for API completeness/testing). */
export function DelayAnalyticsPanel({ trains, columns = 2 }: DelayAnalyticsPanelProps) {
  const tiles = useMemo<readonly Tile[]>(() => {
    // Only trains whose source reports a delay count; an unknown delay is neither late nor on time.
    const stats = delayStats(trains);
    const affected = trains.filter(isLate);
    const totalDelay = stats.totalDelaySeconds;
    const avgDelay = stats.knownCount === 0 ? 0 : totalDelay / stats.knownCount;
    const maxDelay = stats.maxDelaySeconds;
    const affectedPassengers = affected.reduce((sum, t) => sum + (t.passengerCount ?? 0), 0);

    return [
      { label: "Total delay", value: formatDurationSeconds(totalDelay), tone: "neutral" },
      { label: "Average delay", value: formatDurationSeconds(Math.round(avgDelay)), tone: "neutral" },
      { label: "Max delay", value: formatDurationSeconds(maxDelay), tone: maxDelayTone(maxDelay) },
      {
        label: "Affected trains",
        value: String(affected.length),
        tone: affected.length > 0 ? "warning" : "neutral",
      },
      {
        label: "Affected passengers",
        value: affectedPassengers.toLocaleString(),
        tone: affectedPassengers > 0 ? "warning" : "neutral",
      },
    ];
  }, [trains]);

  const gridClass =
    columns === 5 ? "grid-cols-2 md:grid-cols-5" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={`grid gap-x-3 gap-y-4 ${gridClass}`}>
      {tiles.map((tile) => (
        <Metric key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} size="sm" />
      ))}
    </div>
  );
}
