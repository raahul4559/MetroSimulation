import type { Line } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TRAIN_STATUS_LABEL, TRAIN_STATUS_TONE } from "@/lib/metro/trainDisplay";
import { formatOccupancyPercent } from "@/lib/metro/passengerDisplay";

interface TrainListProps {
  trains: readonly TrainState[];
  lines: readonly Line[];
  hiddenLineCodes: ReadonlySet<string>;
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
}

/** All trains currently in the roster, respecting the shared line filter. Clicking a row selects
 * that train (opens `TrainDetails` and focuses the map on it). */
export function TrainList({ trains, lines, hiddenLineCodes, selectedTrainId, onSelectTrain }: TrainListProps) {
  const lineByCode = new Map(lines.map((line) => [line.code, line]));
  const visible = trains.filter((train) => !hiddenLineCodes.has(train.lineCode));

  if (visible.length === 0) {
    return <p className="text-xs text-slate-500">No trains match the current line filter.</p>;
  }

  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
      {visible.map((train) => {
        const line = lineByCode.get(train.lineCode);
        const selected = train.id === selectedTrainId;
        const completed = train.status === "COMPLETED";
        return (
          <li key={train.id}>
            <button
              type="button"
              onClick={() => onSelectTrain(train.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                selected ? "bg-slate-800 ring-1 ring-sky-500" : "hover:bg-slate-800/60"
              } ${completed ? "opacity-50" : ""}`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: line?.colorHex ?? "#94a3b8" }}
                aria-hidden
              />
              <span className="w-10 shrink-0 font-mono font-medium text-slate-100">{train.code}</span>
              <span className="w-4 shrink-0 text-slate-500" aria-label={train.direction}>
                {train.direction === "OUTBOUND" ? "→" : "←"}
              </span>
              <StatusBadge label={TRAIN_STATUS_LABEL[train.status]} tone={TRAIN_STATUS_TONE[train.status]} />
              <span className="ml-auto shrink-0 font-mono text-slate-500">
                {formatOccupancyPercent(train.passengerCount, train.capacity)}
              </span>
              {train.delaySeconds > 0 && (
                <span className="shrink-0 text-amber-400">+{train.delaySeconds}s</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
