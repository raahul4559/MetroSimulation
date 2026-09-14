import type { PassengerMetrics } from "@/domain/trainsim";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";

interface PassengerMetricsPanelProps {
  metrics: PassengerMetrics;
  waitingNow: number;
  onTrainNow: number;
}

/** Cumulative, run-lifetime passenger metrics — served/unable-to-board counts and average
 * wait/travel/journey times — alongside the two live headcounts (`waitingNow`/`onTrainNow`) that
 * aren't in `PassengerMetrics` itself since they're a snapshot of the current roster, not a
 * running total. */
export function PassengerMetricsPanel({ metrics, waitingNow, onTrainNow }: PassengerMetricsPanelProps) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
      <Stat label="Waiting now" value={waitingNow.toLocaleString()} />
      <Stat label="On trains now" value={onTrainNow.toLocaleString()} />
      <Stat label="Served" value={metrics.totalServed.toLocaleString()} />
      <Stat
        label="Unable to board"
        value={metrics.totalUnableToBoard.toLocaleString()}
        tone={metrics.totalUnableToBoard > 0 ? "warning" : undefined}
      />
      <Stat label="Avg. wait" value={formatDurationSeconds(metrics.averageWaitSeconds)} />
      <Stat label="Avg. travel" value={formatDurationSeconds(metrics.averageTravelSeconds)} />
      <Stat
        label="Avg. journey"
        value={formatDurationSeconds(metrics.averageJourneySeconds)}
      />
      <Stat label="Generated" value={metrics.totalGenerated.toLocaleString()} />
    </dl>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" | undefined }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono text-sm ${tone === "warning" ? "text-amber-400" : "text-slate-100"}`}>{value}</dd>
    </div>
  );
}
