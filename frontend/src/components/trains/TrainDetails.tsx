import type { Line, Station } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TRAIN_STATUS_LABEL, TRAIN_STATUS_TONE, describeTrainLocation } from "@/lib/metro/trainDisplay";

interface TrainDetailsProps {
  train: TrainState | null;
  lines: readonly Line[];
  stations: readonly Station[];
}

/** Detail view for the currently selected train — station names resolved from the shared network
 * data, not stored redundantly on the train itself. */
export function TrainDetails({ train, lines, stations }: TrainDetailsProps) {
  if (!train) {
    return <p className="text-xs text-slate-500">Select a train to see its details.</p>;
  }

  const line = lines.find((l) => l.code === train.lineCode);
  const stationsById = new Map(stations.map((s) => [s.id, s]));

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-base font-semibold text-slate-50">{train.code}</p>
          <p className="text-xs text-slate-500">{line?.name ?? train.lineCode}</p>
        </div>
        <StatusBadge label={TRAIN_STATUS_LABEL[train.status]} tone={TRAIN_STATUS_TONE[train.status]} />
      </div>

      <p className="text-xs text-slate-300">{describeTrainLocation(train, stationsById)}</p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Direction" value={train.direction === "OUTBOUND" ? "Outbound" : "Inbound"} />
        <Field label="Speed" value={`${Math.round(train.speedKmph)} km/h`} />
        <Field label="Passengers" value={`${train.passengerCount} / ${train.capacity}`} />
        <Field label="Delay" value={train.delaySeconds > 0 ? `+${train.delaySeconds}s` : "On time"} />
        <Field label="Max speed" value={`${train.maxSpeedKmph} km/h`} />
        <Field label="Dwell time" value={`${train.dwellTimeSeconds}s`} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}
