import type { PassengerMetrics } from "@/domain/trainsim";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { Metric } from "@/components/ui/Metric";

interface PassengerMetricsPanelProps {
  metrics: PassengerMetrics;
  waitingNow: number;
  onTrainNow: number;
  /** Columns in the metric grid. Two in a narrow rail, four across an operations row. */
  columns?: 2 | 4;
}

/** Cumulative, run-lifetime passenger metrics — served/unable-to-board counts and average
 * wait/travel/journey times — alongside the two live headcounts (`waitingNow`/`onTrainNow`) that
 * aren't in `PassengerMetrics` itself since they're a snapshot of the current roster, not a
 * running total. */
export function PassengerMetricsPanel({
  metrics,
  waitingNow,
  onTrainNow,
  columns = 2,
}: PassengerMetricsPanelProps) {
  return (
    <div className={`grid gap-x-3 gap-y-4 ${columns === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
      <Metric label="Waiting now" value={waitingNow.toLocaleString()} size="sm" />
      <Metric label="On trains now" value={onTrainNow.toLocaleString()} size="sm" />
      <Metric label="Served" value={metrics.totalServed.toLocaleString()} size="sm" />
      <Metric
        label="Unable to board"
        value={metrics.totalUnableToBoard.toLocaleString()}
        size="sm"
        tone={metrics.totalUnableToBoard > 0 ? "warning" : "neutral"}
      />
      <Metric label="Avg. wait" value={formatDurationSeconds(metrics.averageWaitSeconds)} size="sm" />
      <Metric label="Avg. travel" value={formatDurationSeconds(metrics.averageTravelSeconds)} size="sm" />
      <Metric label="Avg. journey" value={formatDurationSeconds(metrics.averageJourneySeconds)} size="sm" />
      <Metric label="Generated" value={metrics.totalGenerated.toLocaleString()} size="sm" />
    </div>
  );
}
