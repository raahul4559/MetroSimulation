import { formatOccupancyPercent, occupancyRatio, occupancyTone } from "@/lib/metro/passengerDisplay";
import { cn } from "@/lib/ui/cn";
import { TONE_HEX } from "@/lib/ui/tone";

interface OccupancyBarProps {
  count: number;
  capacity: number;
  /** Compact drops the numeric "742 / 1000" line, keeping just the bar + percentage — for tight
   * spaces like a list row. */
  compact?: boolean;
  className?: string;
}

/** A train's (or any capacity-bounded thing's) occupancy: "742 / 1000", "74.2%", and a coloured
 * fill bar — green under 60% full, amber 60-90%, red 90%+. The one visual this feature's spec
 * calls out by name, so every place that shows a train's crowding uses this, not a bespoke bar.
 *
 * The fill colour is an inline style because it is data-driven; it now resolves through the shared
 * tone scale rather than this file's own copy of the four hexes. */
export function OccupancyBar({ count, capacity, compact = false, className }: OccupancyBarProps) {
  const tone = occupancyTone(count, capacity);
  const percent = formatOccupancyPercent(count, capacity);
  const ratio = occupancyRatio(count, capacity);

  return (
    <div className={cn("w-full", className)}>
      {!compact && (
        <div className="mb-1 flex items-baseline justify-between">
          <span className="tabular text-sm text-content">
            {count} <span className="text-muted">/ {capacity}</span>
          </span>
          <span className="tabular text-xs text-secondary">{percent}</span>
        </div>
      )}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-white/8"
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Occupancy ${percent}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-(--duration-slow) ease-(--ease-out)"
          style={{ width: `${ratio * 100}%`, backgroundColor: TONE_HEX[tone] }}
        />
      </div>
      {compact && <span className="tabular mt-1 block text-right text-[10px] text-muted">{percent}</span>}
    </div>
  );
}
