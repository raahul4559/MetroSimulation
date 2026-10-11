"use client";

import type { ReactNode } from "react";
import { useSimulationData } from "@/providers/SimulationProvider";
import { useDataState } from "@/hooks/useDataState";
import { useHydrated } from "@/hooks/useHydrated";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { cn } from "@/lib/ui/cn";
import type { Tone } from "@/lib/ui/tone";
import type { ConnectionStatus } from "@/lib/ws/realtime-socket";
import { delayDataState } from "@/lib/realtime/dataState";
import { formatAge } from "@/lib/realtime/provenance";
import { formatIstShortDate, formatIstTimeOfDay, localNowMs } from "@/lib/realtime/serverClock";
import {
  NETWORK_STATUS_LABEL,
  SERVICE_TONE,
  lastServiceText,
  nextServiceText,
  unknownExplanation,
} from "@/lib/realtime/serviceStatusDisplay";
import { delayStats, isLate } from "@/lib/metro/trainDisplay";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { DataStateBadge } from "./DataStateBadge";

const CONNECTION: Record<ConnectionStatus, { label: string; tone: Tone }> = {
  connecting: { label: "Connecting…", tone: "warning" },
  connected: { label: "Connected", tone: "positive" },
  disconnected: { label: "Reconnecting…", tone: "danger" },
};

/**
 * The twin's status line, directly under the navbar on every live route — the answers an operator
 * needs before anything else, in order: what time it is in Bengaluru, whether the metro is
 * running, whether this screen is connected, how fresh the train data is, and how the trains are
 * doing.
 *
 * Every value is server-derived: the clock is server time in IST, service status is the server's
 * timetable evaluation, and the data badge comes from `describeDataState`. The connection cell
 * reports the socket alone — it is deliberately separate from the data badge, because a perfectly
 * healthy connection can be delivering a timetable estimate or the simulation.
 */
export function RealtimeStatusBar() {
  const { state, service, trains, connectionStatus, stalled, isSimulationSource, timeOfDay, lastFrameReceivedAtMs } =
    useSimulationData();
  const { network, nowMs } = useDataState();
  // The server-rendered clock would be a second stale by hydration; show it once on the client.
  const hydrated = useHydrated();

  const running = trains.filter((t) => t.status !== "SCHEDULED" && t.status !== "COMPLETED");
  const delays = delayStats(running);
  const late = running.filter(isLate);
  const avgLate = late.length === 0 ? 0 : late.reduce((sum, t) => sum + (t.delaySeconds ?? 0), 0) / late.length;
  const delayState = network ? delayDataState(network, delays.knownCount, running.length) : null;

  const connection = stalled ? { label: "No updates", tone: "danger" as Tone } : CONNECTION[connectionStatus];
  const silentFor =
    lastFrameReceivedAtMs != null && (stalled || connectionStatus === "disconnected")
      ? formatAge(localNowMs() - lastFrameReceivedAtMs)
      : null;

  const serviceSub = service
    ? (unknownExplanation(service) ??
      (nextServiceText(service, nowMs) && `Next service ${nextServiceText(service, nowMs)}`) ??
      (lastServiceText(service) && `Last departure ${lastServiceText(service)}`) ??
      service.reason)
    : "Waiting for status";

  return (
    <div
      className="sticky top-14 z-[var(--z-panel)] shrink-0 border-b border-divider bg-surface-sunken/90 backdrop-blur-xl"
      aria-label="Realtime status"
      role="region"
    >
      <div className="flex h-12 items-stretch gap-0 overflow-hidden px-3 sm:px-4">
        <Cell label="Bengaluru · IST">
          <span className="tabular font-mono text-[15px] font-semibold text-content">
            {hydrated ? formatIstTimeOfDay(nowMs) : "--:--:--"}
          </span>
          {hydrated && <span className="ml-2 hidden text-[11px] text-muted sm:inline">{formatIstShortDate(nowMs)}</span>}
          {isSimulationSource && (
            <span className="tabular ml-2 hidden font-mono text-[11px] text-muted xl:inline" title="Simulated time of day">
              Sim {timeOfDay}
            </span>
          )}
        </Cell>

        <Cell label="Metro service" title={service?.reason}>
          {service ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <StatusIndicator
                label={NETWORK_STATUS_LABEL[service.state]}
                tone={SERVICE_TONE[service.state]}
                className="font-medium"
              />
              <span className="hidden truncate text-[11px] text-muted lg:inline">{serviceSub}</span>
            </span>
          ) : (
            <span className="text-xs text-muted">{serviceSub}</span>
          )}
        </Cell>

        <Cell label="Realtime connection" from="md">
          <StatusIndicator label={connection.label} tone={connection.tone} pulse={connectionStatus === "connecting"} />
          {silentFor && <span className="tabular ml-2 text-[11px] text-muted">{silentFor} silent</span>}
        </Cell>

        <Cell label="Train data">
          <span className="hidden sm:contents">
            <DataStateBadge state={network} layout="inline" />
          </span>
          <span className="contents sm:hidden">
            <DataStateBadge state={network} layout="compact" />
          </span>
        </Cell>

        <Cell label="Trains" from="lg">
          <span className="tabular text-xs text-content">{state ? running.length : "—"}</span>
          <span className="ml-1 text-[11px] text-muted">in service</span>
        </Cell>

        <Cell label="Delays" from="lg" title={delayState?.detail}>
          {delayState?.kind === "UNAVAILABLE" ? (
            <span className="text-xs text-muted">Not reported</span>
          ) : delays.knownCount === 0 ? (
            <span className="text-xs text-muted">—</span>
          ) : late.length === 0 ? (
            <StatusIndicator label="On time" tone="positive" />
          ) : (
            <StatusIndicator
              label={`${late.length} late · avg +${formatDurationSeconds(Math.round(avgLate))}`}
              tone="warning"
            />
          )}
        </Cell>
      </div>
    </div>
  );
}

/** Lower-priority cells drop out as the bar narrows, rather than the bar scrolling sideways. */
const FROM_CLASS = { always: "flex", md: "hidden md:flex", lg: "hidden lg:flex" } as const;

function Cell({
  label,
  title,
  from = "always",
  children,
}: {
  label: string;
  title?: string | undefined;
  from?: keyof typeof FROM_CLASS;
  children: ReactNode;
}) {
  return (
    <div
      title={title}
      className={cn(
        FROM_CLASS[from],
        "min-w-0 flex-col justify-center border-r border-divider px-3 first:pl-0 last:border-r-0 sm:px-4",
      )}
    >
      <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="mt-0.5 flex min-w-0 items-center">{children}</span>
    </div>
  );
}
