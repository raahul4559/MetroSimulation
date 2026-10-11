"use client";

import { useSimulationData } from "@/providers/SimulationProvider";
import { useRealDateTime } from "@/hooks/useRealDateTime";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { cn } from "@/lib/ui/cn";
import type { Tone } from "@/lib/ui/tone";
import type { ProviderStatus } from "@/domain/realtime";
import type { ConnectionStatus } from "@/lib/ws/realtime-socket";
import { deriveDiagnostics } from "@/lib/realtime/diagnostics";
import { formatAge } from "@/lib/realtime/provenance";
import { formatIstTimeOfDay, isServerClockSynced, serverClockOffsetMs } from "@/lib/realtime/serverClock";

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  disconnected: "Disconnected — reconnecting",
};

const CONNECTION_TONE: Record<ConnectionStatus, Tone> = {
  connecting: "warning",
  connected: "positive",
  disconnected: "danger",
};

const PROVIDER_TONE: Record<ProviderStatus, Tone> = {
  UNCONFIGURED: "neutral",
  CONNECTING: "warning",
  HEALTHY: "positive",
  STALE: "warning",
  ERROR: "danger",
};

/** Data older than this reads amber in the panel; the server's own staleness threshold decides
 * the labels everywhere else. */
const AGE_WARNING_MS = 30_000;

/**
 * Realtime diagnostics: what the trains on screen are based on and how old it is.
 *
 * Every figure derives from the same canonical frame the map and 3D scene render, plus the
 * authoritative server clock — ages tick once a second even if frames stop, so a stalled feed is
 * visible here as a growing number rather than a frozen one.
 *
 * `panel` is the full version (operations page, with per-provider health); `overlay` is the compact
 * version shown over the map when "Data diagnostics" is on.
 */
export function RealtimeDiagnostics({ variant = "panel" }: { variant?: "panel" | "overlay" }) {
  const { state, feed, connectionStatus } = useSimulationData();
  const now = useRealDateTime().getTime();

  if (!state) {
    return <StatusIndicator label={CONNECTION_LABEL[connectionStatus]} tone={CONNECTION_TONE[connectionStatus]} />;
  }

  const d = deriveDiagnostics(state, now);
  const rows: [string, React.ReactNode, (Tone | undefined)?][] = [
    ["Data source", <span key="s" title={feed.detail}>{feed.label}</span>, feed.tone],
    [
      "Last update",
      d.lastUpdateMs == null
        ? "—"
        : `${formatIstTimeOfDay(d.lastUpdateMs)}${d.lastUpdateBasis === "COMPUTED" ? " (computed)" : ""}`,
    ],
    [
      "Data age",
      d.dataAgeMs == null ? "—" : formatAge(d.dataAgeMs),
      d.dataAgeMs != null && d.dataAgeMs > AGE_WARNING_MS ? "warning" : undefined,
    ],
    ["Trains", String(d.trainCount)],
    ["Fresh positions", d.estimatedCount > 0 ? `${d.freshCount} (${d.estimatedCount} interpolated)` : String(d.freshCount)],
    ["Stale positions", d.staleCount > 0 ? `${d.staleCount} (estimated)` : "0", d.staleCount > 0 ? "warning" : undefined],
    [
      "Connection",
      `${CONNECTION_LABEL[connectionStatus]}${d.frameAgeMs > 3_000 ? ` · no frame for ${formatAge(d.frameAgeMs)}` : ""}`,
      d.frameAgeMs > 3_000 ? "danger" : CONNECTION_TONE[connectionStatus],
    ],
  ];

  const table = (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3", variant === "overlay" ? "gap-y-1 text-[11px]" : "gap-y-1.5 text-xs")}>
      {rows.map(([label, value, tone]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd
            className={cn(
              "tabular min-w-0 truncate text-right",
              tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-content",
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );

  if (variant === "overlay") return table;

  return (
    <div className="space-y-3">
      {table}
      <p className="text-[11px] text-muted">{state.sourceReason}</p>
      <ul className="space-y-1.5 border-t border-divider pt-2.5">
        {state.providers.map((provider) => (
          <li key={provider.source} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-secondary">{provider.name}</span>
              <StatusIndicator label={provider.status.toLowerCase()} tone={PROVIDER_TONE[provider.status]} />
            </div>
            {(provider.detail || provider.rejectedVehicles > 0) && (
              <p className="mt-0.5 text-[11px] text-muted">
                {provider.detail}
                {provider.rejectedVehicles > 0 &&
                  ` ${provider.acceptedVehicles} placed, ${provider.rejectedVehicles} rejected (${Object.entries(
                    provider.rejectionReasons,
                  )
                    .map(([reason, count]) => `${reason.toLowerCase().replaceAll("_", " ")} ${count}`)
                    .join(", ")})`}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted">
        Server time {formatIstTimeOfDay(now)} IST
        {isServerClockSynced() && ` · this browser's clock is ${formatOffset(serverClockOffsetMs())}`}
      </p>
    </div>
  );
}

function formatOffset(offsetMs: number): string {
  if (Math.abs(offsetMs) < 500) return "in sync";
  return `${formatAge(Math.abs(offsetMs))} ${offsetMs > 0 ? "behind" : "ahead"}`;
}
