import { useState } from "react";
import type { Line, Station, Track } from "@/domain/metro";
import type { Signal, TrainState } from "@/domain/trainsim";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OccupancyBar } from "@/components/ui/OccupancyBar";
import { TRAIN_STATUS_LABEL, TRAIN_STATUS_TONE, describeTrainLocation } from "@/lib/metro/trainDisplay";
import { computeBlockChain } from "@/lib/metro/blockChain";

interface TrainDetailsProps {
  train: TrainState | null;
  lines: readonly Line[];
  stations: readonly Station[];
  tracks: readonly Track[];
  signals: readonly Signal[];
}

const ASPECT_TONE = {
  RED: "danger",
  YELLOW: "warning",
  GREEN: "positive",
} as const;

/** Detail view for the currently selected train — station names resolved from the shared network
 * data, not stored redundantly on the train itself. An optional debug section reveals the raw
 * signaling chain (current block -> next block -> signal -> aspect) behind the plain-English
 * location description above it. */
export function TrainDetails({ train, lines, stations, tracks, signals }: TrainDetailsProps) {
  const [debugMode, setDebugMode] = useState(false);

  if (!train) {
    return <p className="text-xs text-slate-500">Select a train to see its details.</p>;
  }

  const line = lines.find((l) => l.code === train.lineCode);
  const stationsById = new Map(stations.map((s) => [s.id, s]));
  const tracksById = new Map(tracks.map((t) => [t.id, t]));
  const signalsByTrack = new Map(signals.map((s) => [s.trackId, s]));

  function trackLabel(trackId: number | null): string {
    if (trackId == null) return "None";
    const track = tracksById.get(trackId);
    if (!track) return `Block #${trackId}`;
    const from = stationsById.get(track.fromStationId)?.name ?? track.fromStationId;
    const to = stationsById.get(track.toStationId)?.name ?? track.toStationId;
    return `${from} → ${to}`;
  }

  const chain = computeBlockChain(train, lines, tracks);
  const nextSignal = chain.nextTrackId != null ? signalsByTrack.get(chain.nextTrackId) : undefined;

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

      <div>
        <p className="mb-1 text-xs text-slate-500">Occupancy</p>
        <OccupancyBar count={train.passengerCount} capacity={train.capacity} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Direction" value={train.direction === "OUTBOUND" ? "Outbound" : "Inbound"} />
        <Field label="Speed" value={`${Math.round(train.speedKmph)} km/h`} />
        <Field label="Delay" value={train.delaySeconds > 0 ? `+${train.delaySeconds}s` : "On time"} />
        <Field label="Max speed" value={`${train.maxSpeedKmph} km/h`} />
        <Field label="Dwell time" value={`${train.dwellTimeSeconds}s`} />
      </dl>

      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={debugMode}
          onChange={() => setDebugMode((v) => !v)}
          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800"
        />
        Debug mode
      </label>

      {debugMode && (
        <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-900/60 p-2.5 text-xs">
          <ChainRow label="Train" value={train.code} />
          <ChainArrow />
          <ChainRow label="Current block" value={trackLabel(chain.currentTrackId)} />
          <ChainArrow />
          <ChainRow label="Next block" value={trackLabel(chain.nextTrackId)} />
          <ChainArrow />
          <ChainRow label="Signal" value={nextSignal?.id ?? "None"} />
          <ChainArrow />
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Signal state</span>
            {nextSignal ? (
              <StatusBadge label={nextSignal.aspect} tone={ASPECT_TONE[nextSignal.aspect]} />
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        </div>
      )}
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

function ChainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function ChainArrow() {
  return <div className="text-center text-slate-600">↓</div>;
}
