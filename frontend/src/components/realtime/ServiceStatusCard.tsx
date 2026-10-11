"use client";

import { useNetworkData, useSimulationData } from "@/providers/SimulationProvider";
import { useRealDateTime } from "@/hooks/useRealDateTime";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Surface } from "@/components/ui/Surface";
import { LineBadge } from "@/components/ui/LineBadge";
import {
  LINE_STATUS_LABEL,
  NETWORK_STATUS_LABEL,
  SERVICE_TONE,
  lastServiceText,
  nextServiceText,
  unknownExplanation,
} from "@/lib/realtime/serviceStatusDisplay";

/**
 * Namma Metro's operating status per line, plus when service next starts.
 *
 * Reads the server's `ServiceStatus` from the canonical frame — the real metro's status by its
 * timetable, alerts and observed trains, whatever source the trains on the map come from. The next
 * service time appears only when the timetable supplies one. The IST clock and the network-wide
 * status live in the status bar above every live page, so the map card doesn't repeat them.
 *
 * `overlay` is the compact card floating on the map; `panel` sits inside a Panel on /operations and
 * adds the network status, last departure and the timetable's cited source.
 */
export function ServiceStatusCard({ variant = "overlay" }: { variant?: "overlay" | "panel" }) {
  const { service } = useSimulationData();
  const { lines } = useNetworkData();
  const nowMs = useRealDateTime().getTime();

  const body = service ? (
    <>
      {variant === "panel" && (
        <div className="mb-3" title={service.reason}>
          <StatusIndicator
            label={NETWORK_STATUS_LABEL[service.state]}
            tone={SERVICE_TONE[service.state]}
            size="md"
            className="font-semibold"
          />
          <p className="mt-1 text-[11px] text-muted">{unknownExplanation(service) ?? service.reason}</p>
        </div>
      )}
      {service.scheduleExceptions.length > 0 && (
        <p className="mb-2 text-[11px] text-warning">{service.scheduleExceptions.join(" · ")}</p>
      )}

      <ul className="space-y-1.5">
        {service.lines.map((status) => {
          const line = lines.find((l) => l.code === status.lineCode);
          return (
            <li key={status.lineCode} className="flex items-center justify-between gap-4 text-xs" title={status.reason ?? undefined}>
              <span className="flex min-w-0 items-center gap-1.5">
                <LineBadge line={line ?? null} variant="dot" />
                <span className="truncate text-secondary">{line?.name ?? status.lineCode}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                {variant === "panel" && status.state === "OPERATING" && status.lastDeparture && (
                  <span className="tabular font-mono text-[10px] text-muted">
                    until {status.lastDeparture}
                  </span>
                )}
                <StatusIndicator label={LINE_STATUS_LABEL[status.state]} tone={SERVICE_TONE[status.state]} />
              </span>
            </li>
          );
        })}
      </ul>

      {nextServiceText(service, nowMs) && (
        <div className="mt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Next scheduled service</p>
          <p className="tabular mt-0.5 font-mono text-sm text-content">{nextServiceText(service, nowMs)}</p>
        </div>
      )}
      {lastServiceText(service) && variant === "panel" && (
        <p className="mt-2 text-[11px] text-muted">Last scheduled departure {lastServiceText(service)}</p>
      )}
      {variant === "panel" && (
        <p className="mt-2 text-[11px] text-muted">
          {service.timetableConfigured
            ? `Timetable: ${service.timetableSource || "configured (no source cited)"}`
            : "No timetable configured — next/last service times are not shown."}
        </p>
      )}
    </>
  ) : (
    <p className="text-xs text-muted">Waiting for status…</p>
  );

  if (variant === "panel") return <div>{body}</div>;
  return (
    <Surface variant="overlay" padding="none" className="pointer-events-auto w-[220px] px-3.5 py-3">
      <h2 className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Line service</h2>
      {body}
    </Surface>
  );
}
