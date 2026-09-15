"use client";

import { Box } from "lucide-react";
import type { Line, Station, Track } from "@/domain/metro";
import type { Passenger, TrainState } from "@/domain/trainsim";
import { getLinesForStation } from "@/lib/metro/selectors";
import {
  DENSITY_LABEL,
  DENSITY_TONE,
  densityLevel,
  getStationQueue,
} from "@/lib/metro/passengerDisplay";
import { formatEta, getStationArrivals } from "@/lib/metro/stationArrivals";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { lineVividColor } from "@/lib/ui/lineColor";
import { cn } from "@/lib/ui/cn";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { LineBadge } from "@/components/ui/LineBadge";
import { Metric } from "@/components/ui/Metric";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

interface StationPanelProps {
  station: Station;
  lines: readonly Line[];
  tracks: readonly Track[];
  trains: readonly TrainState[];
  passengers: readonly Passenger[];
  onClose: () => void;
  onEnter3D?: ((station: Station) => void) | undefined;
}

const TYPE_LABEL: Record<Station["stationType"], string> = {
  REGULAR: "Regular station",
  INTERCHANGE: "Interchange",
  TERMINAL: "Terminus",
};

/**
 * The contextual panel for a selected station.
 *
 * Ordered the way an operator reads it: what this station is, whether it is working, what is
 * arriving next, then the numbers, then the way in. The previous version led with five equally
 * weighted sections (lines, nearby stations, current trains, queue, data feed) which meant the
 * single most time-sensitive fact — the next train — was three sections down.
 *
 * Reads only from props; arrivals and platform numbers are derived in `lib/metro/stationArrivals`,
 * not computed here.
 */
export function StationPanel({
  station,
  lines,
  tracks,
  trains,
  passengers,
  onClose,
  onEnter3D,
}: StationPanelProps) {
  const stationLines = getLinesForStation(station, lines);
  const arrivals = getStationArrivals(station, trains, tracks, lines);
  const queue = getStationQueue(passengers, station.id);
  const density = densityLevel(queue.length);

  const next = arrivals[0];
  const upcoming = arrivals.slice(1, 4);
  const avgDelay =
    arrivals.length > 0
      ? Math.round(arrivals.reduce((sum, a) => sum + a.train.delaySeconds, 0) / arrivals.length)
      : 0;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={station.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          {stationLines.map((line) => (
            <LineBadge key={line.id} line={line} />
          ))}
        </span>
      }
      footer={
        onEnter3D && (
          <Button fullWidth icon={<Box size={15} />} onClick={() => onEnter3D(station)}>
            Enter 3D Station
          </Button>
        )
      }
    >
      <div className="flex items-center justify-between gap-2 pb-4">
        <StatusIndicator label="Operational" tone="positive" size="md" />
        <span className="text-[11px] text-muted">
          {TYPE_LABEL[station.stationType]} · {station.code}
        </span>
      </div>

      <Section title="Next train">
        {next ? (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-content">
                <span style={{ color: lineVividColor(next.line) }}>
                  {next.line?.name ?? next.train.lineCode}
                </span>
                <span className="text-muted"> → </span>
                {next.destinationName}
              </p>
              <p className="tabular shrink-0 font-mono text-lg font-semibold text-content">
                {formatEta(next.etaSeconds)}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {next.platformNumber != null && `Platform ${next.platformNumber} · `}
              {next.atPlatform ? "At platform" : "Arriving"}
              {next.train.delaySeconds > 0 && (
                <span className="text-warning">
                  {" "}
                  · +{formatDurationSeconds(next.train.delaySeconds)}
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted">No trains currently approaching.</p>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section title="Then">
          <ul className="space-y-1.5">
            {upcoming.map((arrival) => (
              <li
                key={arrival.train.id}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <LineBadge line={arrival.line ?? null} variant="dot" />
                  <span className="truncate text-secondary">{arrival.destinationName}</span>
                </span>
                <span className="tabular shrink-0 font-mono text-muted">
                  {formatEta(arrival.etaSeconds)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Right now">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <Metric label="Platforms" value={stationLines.length} size="sm" />
          <Metric label="Incoming" value={arrivals.length} size="sm" />
          <Metric
            label="Passengers"
            value={queue.length}
            size="sm"
            tone={DENSITY_TONE[density]}
            sublabel={`${DENSITY_LABEL[density]} density`}
          />
          <Metric
            label="Avg delay"
            value={avgDelay > 0 ? `+${formatDurationSeconds(avgDelay)}` : "On time"}
            size="sm"
            tone={avgDelay > 0 ? "warning" : "neutral"}
          />
        </div>
      </Section>

      {queue.length > 0 && (
        <p className="tabular text-[11px] text-muted">
          {queue.filter((p) => p.status === "TRANSFER").length} transferring ·{" "}
          {queue.filter((p) => p.status === "WAITING").length} first boarding
        </p>
      )}
    </BottomSheet>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-divider py-4 first-of-type:border-t-0", className)}>
      <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}
