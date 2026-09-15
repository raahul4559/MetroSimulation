import type { Line, Station } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import { cn } from "@/lib/ui/cn";
import { LineBadge } from "@/components/ui/LineBadge";
import { OccupancyBar } from "@/components/ui/OccupancyBar";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { TRAIN_STATUS_LABEL, TRAIN_STATUS_TONE } from "@/lib/metro/trainDisplay";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";

interface TrainCardProps {
  train: TrainState;
  line: Line | undefined;
  stationsById: ReadonlyMap<number, Station>;
  selected?: boolean;
  onSelect?: (id: number) => void;
  /** Drops the occupancy bar and the from/to line for very dense rails. */
  compact?: boolean;
  className?: string;
}

/**
 * One train, at a glance: number, line, direction, where it is, how fast, how late, how full.
 *
 * The status is a dot-and-label rather than a filled badge on purpose — a roster of twenty trains
 * rendered as twenty saturated chips drowns out the line colours, which are the only thing in this
 * interface that should compete for attention.
 */
export function TrainCard({
  train,
  line,
  stationsById,
  selected = false,
  onSelect,
  compact = false,
  className,
}: TrainCardProps) {
  const from = stationsById.get(train.previousStationId)?.name ?? `#${train.previousStationId}`;
  const to = stationsById.get(train.nextStationId)?.name ?? `#${train.nextStationId}`;
  const completed = train.status === "COMPLETED";
  const late = train.delaySeconds > 0;

  const body = (
    <>
      <div className="flex items-center gap-2">
        <LineBadge line={line} variant="dot" />
        <span className="tabular font-mono text-xs font-medium text-content">{train.code}</span>
        <StatusIndicator
          label={TRAIN_STATUS_LABEL[train.status]}
          tone={TRAIN_STATUS_TONE[train.status]}
          className="ml-1"
        />
        <span className="tabular ml-auto shrink-0 text-[11px] text-muted">
          {Math.round(train.speedKmph)} km/h
        </span>
      </div>

      {!compact && (
        <p className="mt-1.5 truncate text-[11px] text-secondary">
          {from} <span className="text-muted">→</span> {to}
        </p>
      )}

      <div className="mt-1.5 flex items-center gap-3">
        <span
          className={cn("tabular shrink-0 text-[11px]", late ? "text-warning" : "text-muted")}
        >
          {late ? `+${formatDurationSeconds(train.delaySeconds)}` : "On time"}
        </span>
        {!compact && (
          <OccupancyBar
            count={train.passengerCount}
            capacity={train.capacity}
            compact
            className="min-w-0 flex-1"
          />
        )}
      </div>
    </>
  );

  const shell = cn(
    "block w-full rounded-md px-2.5 py-2 text-left",
    "ring-1 ring-inset transition-colors duration-(--duration-fast) ease-(--ease-out)",
    selected ? "bg-white/8 ring-accent/60" : "ring-transparent hover:bg-white/5",
    completed && "opacity-50",
    className,
  );

  if (!onSelect) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={() => onSelect(train.id)}
      aria-pressed={selected}
      className={shell}
    >
      {body}
    </button>
  );
}
