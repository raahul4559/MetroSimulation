import { useState } from "react";
import { ArrowDown } from "lucide-react";
import type { Line, Station, Track } from "@/domain/metro";
import type { Signal, TrainState } from "@/domain/trainsim";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OccupancyBar } from "@/components/ui/OccupancyBar";
import { LineBadge } from "@/components/ui/LineBadge";
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
    return <p className="text-xs text-muted">Select a train to see its details.</p>;
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="tabular font-mono text-base font-semibold text-content">{train.code}</p>
          <LineBadge line={line ?? null} className="mt-1.5" />
        </div>
        <StatusBadge label={TRAIN_STATUS_LABEL[train.status]} tone={TRAIN_STATUS_TONE[train.status]} />
      </div>

      <p className="text-xs text-secondary">{describeTrainLocation(train, stationsById)}</p>

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Occupancy</p>
        <OccupancyBar count={train.passengerCount} capacity={train.capacity} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Direction" value={train.direction === "OUTBOUND" ? "Outbound" : "Inbound"} />
        <Field label="Speed" value={`${Math.round(train.speedKmph)} km/h`} />
        <Field label="Delay" value={train.delaySeconds > 0 ? `+${train.delaySeconds}s` : "On time"} />
        <Field label="Max speed" value={`${train.maxSpeedKmph} km/h`} />
        <Field label="Dwell time" value={`${train.dwellTimeSeconds}s`} />
      </dl>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-secondary">
        <input
          type="checkbox"
          checked={debugMode}
          onChange={() => setDebugMode((v) => !v)}
          className="size-3.5 rounded accent-[var(--color-accent)]"
        />
        Debug mode
      </label>

      {debugMode && (
        <div className="space-y-1.5 rounded-md bg-surface-sunken p-2.5 text-xs ring-1 ring-inset ring-divider">
          <ChainRow label="Train" value={train.code} />
          <ChainArrow />
          <ChainRow label="Current block" value={trackLabel(chain.currentTrackId)} />
          <ChainArrow />
          <ChainRow label="Next block" value={trackLabel(chain.nextTrackId)} />
          <ChainArrow />
          <ChainRow label="Signal" value={nextSignal?.id ?? "None"} />
          <ChainArrow />
          <div className="flex items-center justify-between">
            <span className="text-muted">Signal state</span>
            {nextSignal ? (
              <StatusBadge label={nextSignal.aspect} tone={ASPECT_TONE[nextSignal.aspect]} />
            ) : (
              <span className="text-secondary">—</span>
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
      <dt className="text-muted">{label}</dt>
      <dd className="tabular text-content">{value}</dd>
    </div>
  );
}

function ChainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="tabular text-content">{value}</span>
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex justify-center text-muted" aria-hidden>
      <ArrowDown size={12} />
    </div>
  );
}
