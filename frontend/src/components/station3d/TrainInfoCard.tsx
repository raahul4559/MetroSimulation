"use client";

import type { PlatformLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import type { StationArrival } from "@/lib/metro/stationArrivals";
import { formatEta } from "@/lib/metro/stationArrivals";
import type { DataState } from "@/lib/realtime/dataState";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { formatDelay, isLate } from "@/lib/metro/trainDisplay";
import { lineVividColor } from "@/lib/ui/lineColor";
import { cn } from "@/lib/ui/cn";
import { Surface } from "@/components/ui/Surface";
import { DataStateBadge } from "@/components/realtime/DataStateBadge";

const PHASE_LABEL: Record<TrainPhase3D, string> = {
  APPROACHING: "Approaching",
  ARRIVING: "Arriving",
  STOPPED: "At platform",
  BOARDING: "Doors open",
  DEPARTING: "Departing",
};

interface TrainInfoCardProps {
  train: TrainVisual3D | null;
  platform: PlatformLayout3D | undefined;
  /** The selected train's arrival here, from `getStationArrivals` — null once it has left. */
  arrival: StationArrival | null;
  /** This train's data state (`describeTrainDataState`). */
  dataState: DataState | null;
  /** Other trains currently visible here, offered as a compact selector when there's more than one. */
  trains: readonly TrainVisual3D[];
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
}

/**
 * The one train readout inside the 3D station:
 *
 *   Train 1204
 *   → Whitefield
 *   Platform 2 · Arriving
 *   ETA 01:32
 *   ● LIVE  Updated 7s ago
 *
 * Deliberately small. Inside a station the scene is the content; occupancy, signalling and the
 * rest live on /operations. The ETA says what it is based on whenever it isn't a feed prediction.
 */
export function TrainInfoCard({
  train,
  platform,
  arrival,
  dataState,
  trains,
  selectedTrainId,
  onSelectTrain,
}: TrainInfoCardProps) {
  if (!train) {
    return (
      <Surface variant="overlay" padding="none" className="pointer-events-auto px-3.5 py-2.5">
        <p className="text-xs text-muted">No train at this station right now.</p>
      </Surface>
    );
  }

  const showEta = arrival != null && !arrival.atPlatform && train.phase !== "DEPARTING";
  const etaQualifier =
    arrival == null
      ? null
      : arrival.etaBasis === "TIMETABLE"
        ? "scheduled"
        : arrival.etaBasis === "NOMINAL" && train.source !== "SIMULATION"
          ? "estimated"
          : null;

  return (
    <div className="pointer-events-auto flex w-[min(17rem,calc(100vw-1.5rem))] flex-col gap-2">
      {trains.length > 1 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Trains at this station">
          {trains.map((t) => {
            const active = t.trainId === (selectedTrainId ?? train.trainId);
            return (
              <button
                key={t.trainId}
                type="button"
                onClick={() => onSelectTrain(t.trainId)}
                aria-pressed={active}
                className={cn(
                  "tabular rounded-md px-2 py-0.5 font-mono text-[11px] ring-1 ring-inset backdrop-blur-xl",
                  "transition-colors duration-(--duration-fast) ease-(--ease-out)",
                  active ? "bg-surface/90 text-content ring-edge-strong" : "bg-surface/60 text-muted ring-edge hover:text-secondary",
                )}
              >
                {t.code}
              </button>
            );
          })}
        </div>
      )}

      <Surface variant="overlay" padding="none" className="px-3.5 py-3">
        <p className="tabular font-mono text-sm font-semibold text-content">Train {train.code}</p>
        <p className="mt-0.5 truncate text-sm text-secondary">
          <span aria-hidden style={{ color: lineVividColor({ code: train.lineCode, colorHex: train.colorHex }) }}>
            →{" "}
          </span>
          {train.destinationStationName || "—"}
        </p>

        <p className="mt-2.5 text-xs text-content">
          {platform && <span className="tabular">Platform {platform.platformNumber}</span>}
          {platform && <span className="text-muted"> · </span>}
          {PHASE_LABEL[train.phase]}
        </p>

        {showEta && (
          <p className="tabular mt-1 font-mono text-lg font-semibold leading-tight text-content">
            <span className="mr-2 font-sans text-[10px] font-medium uppercase tracking-wider text-muted">ETA</span>
            {formatEta(arrival.etaSeconds)}
            {etaQualifier && <span className="ml-1.5 font-sans text-[10px] font-normal text-muted">{etaQualifier}</span>}
          </p>
        )}
        {isLate(train) && (
          <p className="tabular mt-1 text-[11px] text-warning">{formatDelay(train, formatDurationSeconds)}</p>
        )}

        <div className="mt-2.5 border-t border-divider pt-2">
          <DataStateBadge state={dataState} />
        </div>
      </Surface>
    </div>
  );
}
