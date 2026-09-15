"use client";

import type { PlatformLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import { cn } from "@/lib/ui/cn";
import { formatDurationSeconds, formatOccupancyPercent } from "@/lib/metro/passengerDisplay";
import { lineVividColor } from "@/lib/ui/lineColor";
import { OccupancyBar } from "@/components/ui/OccupancyBar";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Surface } from "@/components/ui/Surface";
import type { Tone } from "@/lib/ui/tone";

const PHASE_LABEL: Record<TrainPhase3D, string> = {
  APPROACHING: "Approaching",
  ARRIVING: "Arriving",
  STOPPED: "At platform",
  BOARDING: "Doors open",
  DEPARTING: "Departing",
};

const PHASE_TONE: Record<TrainPhase3D, Tone> = {
  APPROACHING: "neutral",
  ARRIVING: "info",
  STOPPED: "neutral",
  BOARDING: "positive",
  DEPARTING: "info",
};

interface TrainInfoBarProps {
  train: TrainVisual3D | null;
  platform: PlatformLayout3D | undefined;
  nextTrainCode: string | null;
  boardingCount: number;
  alightingCount: number;
  /** Other trains currently visible here, offered as a compact selector when there's more than one. */
  trains: readonly TrainVisual3D[];
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
}

/**
 * The station's bottom information bar: which train, where it is going, which platform, what it is
 * doing right now.
 *
 * Deliberately one strip rather than a stack of cards. Inside a station the 3D scene is the
 * content; the UI's job is operational clarity at a glance, not a second dashboard competing with
 * the view behind it.
 */
export function TrainInfoBar({
  train,
  platform,
  nextTrainCode,
  boardingCount,
  alightingCount,
  trains,
  selectedTrainId,
  onSelectTrain,
}: TrainInfoBarProps) {
  if (!train) {
    return (
      <Surface variant="overlay" padding="sm" className="pointer-events-auto">
        <p className="text-xs text-muted">No train currently at this station.</p>
      </Surface>
    );
  }

  const late = train.delaySeconds > 0;

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      {trains.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Trains at this station">
          {trains.map((t) => {
            const active = t.trainId === (selectedTrainId ?? train.trainId);
            return (
              <button
                key={t.trainId}
                type="button"
                onClick={() => onSelectTrain(t.trainId)}
                aria-pressed={active}
                className={cn(
                  "tabular rounded-full px-2.5 py-1 font-mono text-[11px] ring-1 ring-inset",
                  "transition-colors duration-(--duration-fast) ease-(--ease-out)",
                  active
                    ? "bg-surface/90 text-content ring-edge-strong backdrop-blur-xl"
                    : "bg-surface/60 text-muted ring-edge backdrop-blur-xl hover:text-secondary",
                )}
              >
                {t.code}
              </button>
            );
          })}
        </div>
      )}

      <Surface
        variant="overlay"
        padding="none"
        className="flex w-full max-w-2xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5"
      >
        <div className="min-w-0">
          <p className="tabular font-mono text-sm font-medium text-content">TRAIN {train.code}</p>
          <p className="mt-0.5 truncate text-[11px] text-secondary">
            <span style={{ color: lineVividColor({ code: train.lineCode, colorHex: train.colorHex }) }}>
              {platform?.lineName ?? train.lineCode}
            </span>
            <span className="text-muted"> → </span>
            {train.destinationStationName || "—"}
          </p>
        </div>

        {platform && (
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Platform</p>
            <p className="tabular mt-0.5 text-sm text-content">{platform.platformNumber}</p>
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Next stop</p>
          <p className="mt-0.5 truncate text-xs text-content">{train.nextStationName || "Terminus"}</p>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Load</p>
          <p className="tabular mt-0.5 text-xs text-content">
            {formatOccupancyPercent(train.passengerCount, train.capacity)}
          </p>
        </div>

        <div className="ml-auto flex flex-col items-end gap-1">
          <StatusIndicator label={PHASE_LABEL[train.phase]} tone={PHASE_TONE[train.phase]} />
          <span className={cn("tabular text-[11px]", late ? "text-warning" : "text-muted")}>
            {late ? `+${formatDurationSeconds(train.delaySeconds)}` : "On time"}
          </span>
        </div>

        <OccupancyBar
          count={train.passengerCount}
          capacity={train.capacity}
          compact
          className="basis-full"
        />

        {(train.phase === "BOARDING" || nextTrainCode) && (
          <p className="basis-full text-[11px] text-muted">
            {train.phase === "BOARDING" && (
              <span className="tabular">
                {boardingCount} boarding · {alightingCount} alighting
              </span>
            )}
            {train.phase === "BOARDING" && nextTrainCode && <span> · </span>}
            {nextTrainCode && <span className="tabular font-mono">Next: {nextTrainCode}</span>}
          </p>
        )}
      </Surface>
    </div>
  );
}
