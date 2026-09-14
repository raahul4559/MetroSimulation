import type { Disruption } from "@/domain/trainsim";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DISRUPTION_STATUS_LABEL, DISRUPTION_STATUS_TONE, DISRUPTION_TYPE_LABEL } from "@/lib/metro/disruptionDisplay";

interface ActiveDisruptionsListProps {
  disruptions: readonly Disruption[];
  elapsedSeconds: number;
  onCancel: (id: number) => void;
}

/** Every disruption this run (any status) — most recently created first. Cancel is only offered
 * while a disruption could still be doing something (SCHEDULED/ACTIVE). */
export function ActiveDisruptionsList({ disruptions, elapsedSeconds, onCancel }: ActiveDisruptionsListProps) {
  if (disruptions.length === 0) {
    return <p className="text-xs text-slate-500">No disruptions yet.</p>;
  }

  const sorted = [...disruptions].sort((a, b) => b.id - a.id);

  return (
    <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((d) => {
        const remaining = Math.max(0, d.endSeconds - elapsedSeconds);
        const cancellable = d.status === "SCHEDULED" || d.status === "ACTIVE";
        return (
          <li key={d.id} className="rounded-md bg-slate-800/60 px-2.5 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-200">{DISRUPTION_TYPE_LABEL[d.type]}</span>
              <StatusBadge label={DISRUPTION_STATUS_LABEL[d.status]} tone={DISRUPTION_STATUS_TONE[d.status]} />
            </div>
            <p className="mt-1 text-slate-400">{d.description}</p>
            <div className="mt-1 flex items-center justify-between text-slate-500">
              <span>
                {d.resourceType} #{d.resourceId} · {d.severity}
                {d.status === "ACTIVE" && remaining > 0 ? ` · ${remaining}s left` : ""}
              </span>
              {cancellable && (
                <button
                  type="button"
                  onClick={() => onCancel(d.id)}
                  className="rounded px-1.5 py-0.5 text-red-400 transition-colors hover:bg-red-900/40"
                >
                  Cancel
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
