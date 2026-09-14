import { formatOccupancyPercent, occupancyRatio, occupancyTone } from "@/lib/metro/passengerDisplay";

interface OccupancyBarProps {
  count: number;
  capacity: number;
  /** Compact drops the numeric "742 / 1000" line, keeping just the bar + percentage — for tight
   * spaces like a list row. */
  compact?: boolean;
}

const TONE_BAR_COLOR: Record<"neutral" | "positive" | "warning" | "danger", string> = {
  neutral: "#94a3b8",
  positive: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
};

/** A train's (or any capacity-bounded thing's) occupancy: "742 / 1000", "74.2%", and a coloured
 * fill bar — green under 60% full, amber 60-90%, red 90%+. The one visual this feature's spec
 * calls out by name, so every place that shows a train's crowding uses this, not a bespoke bar. */
export function OccupancyBar({ count, capacity, compact = false }: OccupancyBarProps) {
  const tone = occupancyTone(count, capacity);
  const percent = formatOccupancyPercent(count, capacity);
  const ratio = occupancyRatio(count, capacity);

  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-sm text-slate-100">
            {count} / {capacity}
          </span>
          <span className="text-xs text-slate-400">{percent}</span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Occupancy ${percent}`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${ratio * 100}%`, backgroundColor: TONE_BAR_COLOR[tone] }}
        />
      </div>
      {compact && <span className="mt-0.5 block text-right text-[10px] text-slate-500">{percent}</span>}
    </div>
  );
}
