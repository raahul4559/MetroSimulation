import type { Line, Station } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import { TrainCard } from "./TrainCard";

interface TrainListProps {
  trains: readonly TrainState[];
  lines: readonly Line[];
  stations: readonly Station[];
  hiddenLineCodes: ReadonlySet<string>;
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
  /** Caps the scroll height. Omit to let the list size to its container. */
  maxHeightClass?: string;
}

/** All trains currently in the roster, respecting the shared line filter. Clicking a row selects
 * that train (opens `TrainDetails` and focuses the map on it). */
export function TrainList({
  trains,
  lines,
  stations,
  hiddenLineCodes,
  selectedTrainId,
  onSelectTrain,
  maxHeightClass = "max-h-72",
}: TrainListProps) {
  const lineByCode = new Map(lines.map((line) => [line.code, line]));
  const stationsById = new Map(stations.map((s) => [s.id, s]));
  const visible = trains.filter((train) => !hiddenLineCodes.has(train.lineCode));

  if (visible.length === 0) {
    return <p className="text-xs text-muted">No trains match the current line filter.</p>;
  }

  return (
    <ul className={`scroll-thin space-y-0.5 overflow-y-auto pr-1 ${maxHeightClass}`}>
      {visible.map((train) => (
        <li key={train.id}>
          <TrainCard
            train={train}
            line={lineByCode.get(train.lineCode)}
            stationsById={stationsById}
            selected={train.id === selectedTrainId}
            onSelect={onSelectTrain}
          />
        </li>
      ))}
    </ul>
  );
}
