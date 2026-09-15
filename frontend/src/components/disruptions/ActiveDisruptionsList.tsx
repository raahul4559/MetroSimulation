import type { Disruption } from "@/domain/trainsim";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  DISRUPTION_SEVERITY_LABEL,
  DISRUPTION_STATUS_LABEL,
  DISRUPTION_STATUS_TONE,
  DISRUPTION_TYPE_LABEL,
  RESOURCE_TYPE_LABEL,
} from "@/lib/metro/disruptionDisplay";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";

interface ActiveDisruptionsListProps {
  disruptions: readonly Disruption[];
  elapsedSeconds: number;
  onCancel: (id: number) => void;
  maxHeightClass?: string;
}

/** Every disruption this run (any status) — most recently created first. Cancel is only offered
 * while a disruption could still be doing something (SCHEDULED/ACTIVE). */
export function ActiveDisruptionsList({
  disruptions,
  elapsedSeconds,
  onCancel,
  maxHeightClass = "max-h-64",
}: ActiveDisruptionsListProps) {
  if (disruptions.length === 0) {
    return <p className="text-xs text-muted">No disruptions yet.</p>;
  }

  const sorted = [...disruptions].sort((a, b) => b.id - a.id);

  return (
    <ul className={`scroll-thin space-y-1.5 overflow-y-auto pr-1 ${maxHeightClass}`}>
      {sorted.map((d) => {
        const remaining = Math.max(0, d.endSeconds - elapsedSeconds);
        const cancellable = d.status === "SCHEDULED" || d.status === "ACTIVE";
        return (
          <li
            key={d.id}
            className="rounded-md bg-surface-sunken px-2.5 py-2 text-xs ring-1 ring-inset ring-divider"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-content">{DISRUPTION_TYPE_LABEL[d.type]}</span>
              <StatusBadge
                label={DISRUPTION_STATUS_LABEL[d.status]}
                tone={DISRUPTION_STATUS_TONE[d.status]}
              />
            </div>
            <p className="mt-1 text-secondary">{d.description}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted">
              <span className="tabular truncate">
                {RESOURCE_TYPE_LABEL[d.resourceType]} #{d.resourceId} ·{" "}
                {DISRUPTION_SEVERITY_LABEL[d.severity]}
                {d.status === "ACTIVE" && remaining > 0
                  ? ` · ${formatDurationSeconds(remaining)} left`
                  : ""}
              </span>
              {cancellable && (
                <Button variant="ghost" size="sm" onClick={() => onCancel(d.id)} className="-mr-1.5 shrink-0 text-danger hover:text-danger">
                  Cancel
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
