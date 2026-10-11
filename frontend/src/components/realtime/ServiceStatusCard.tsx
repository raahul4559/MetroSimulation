"use client";

import { useNetworkData, useSimulationData } from "@/providers/SimulationProvider";
import { useRealDateTime } from "@/hooks/useRealDateTime";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Surface } from "@/components/ui/Surface";
import { LineBadge } from "@/components/ui/LineBadge";
import { cn } from "@/lib/ui/cn";
import { formatIstHourMinute } from "@/lib/realtime/serverClock";
import { deriveDiagnostics } from "@/lib/realtime/diagnostics";
import { formatAge } from "@/lib/realtime/provenance";
import {
  LINE_STATUS_LABEL,
  NETWORK_STATUS_LABEL,
  SERVICE_TONE,
  lastServiceText,
  nextServiceText,
  unknownExplanation,
} from "@/lib/realtime/serviceStatusDisplay";

/**
 * Namma Metro's operating status: the IST clock (server time), whether service is running, each
 * line, when service next starts, and how fresh the data behind the map is.
 *
 * Reads the server's `ServiceStatus` from the canonical frame — the real metro's status by its
 * timetable, alerts and observed trains, whatever source the trains on the map come from. The next
 * service time appears only when the timetable supplies one.
 *
 * `overlay` is the compact card floating on the map; `panel` sits inside a Panel on /operations.
 */
export function ServiceStatusCard({ variant = "overlay" }: { variant?: "overlay" | "panel" }) {
  const { state, service, feed } = useSimulationData();
  const { lines } = useNetworkData();
  const now = useRealDateTime().getTime();

  const body = (
    <>
      <p className="tabular font-mono text-2xl font-semibold leading-none text-content">
        {formatIstHourMinute(now)}
        <span className="ml-1.5 text-xs font-normal text-muted">IST</span>
      </p>
      <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Namma Metro</p>

      {service ? (
        <>
          <span title={service.reason}>
            <StatusIndicator
              label={NETWORK_STATUS_LABEL[service.state].toUpperCase()}
              tone={SERVICE_TONE[service.state]}
              size="md"
              className="mt-1 font-semibold tracking-wide"
            />
          </span>
          {unknownExplanation(service) && (
            <p className="mt-1 text-[11px] text-muted">{unknownExplanation(service)}</p>
          )}
          {service.scheduleExceptions.length > 0 && (
            <p className="mt-1 text-[11px] text-warning">{service.scheduleExceptions.join(" · ")}</p>
          )}

          <ul className={cn("mt-3 space-y-1.5", variant === "overlay" && "hidden sm:block")}>
            {service.lines.map((status) => {
              const line = lines.find((l) => l.code === status.lineCode);
              return (
                <li key={status.lineCode} className="flex items-center justify-between gap-4 text-xs" title={status.reason ?? undefined}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <LineBadge line={line ?? null} variant="dot" />
                    <span className="truncate text-secondary">{line?.name ?? status.lineCode}</span>
                  </span>
                  <StatusIndicator label={LINE_STATUS_LABEL[status.state]} tone={SERVICE_TONE[status.state]} />
                </li>
              );
            })}
          </ul>

          {nextServiceText(service, now) && (
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Next scheduled service</p>
              <p className="tabular mt-0.5 font-mono text-sm text-content">{nextServiceText(service, now)}</p>
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
        <p className="mt-1 text-xs text-muted">Waiting for status…</p>
      )}

      {state && (
        <div className="mt-3 border-t border-divider pt-2.5" title={feed.detail}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Data on map</p>
          <p className="mt-0.5 flex items-center justify-between gap-3 text-xs">
            <StatusIndicator label={feed.label} tone={feed.tone} />
            <DataAge frame={state} now={now} />
          </p>
        </div>
      )}
    </>
  );

  if (variant === "panel") return <div>{body}</div>;
  return (
    <Surface variant="overlay" padding="none" className="pointer-events-auto w-[220px] px-3.5 py-3">
      {body}
    </Surface>
  );
}

function DataAge({ frame, now }: { frame: NonNullable<ReturnType<typeof useSimulationData>["state"]>; now: number }) {
  const { dataAgeMs, lastUpdateBasis } = deriveDiagnostics(frame, now);
  if (dataAgeMs == null) return <span className="text-muted">—</span>;
  return (
    <span className={cn("tabular shrink-0", dataAgeMs > 30_000 ? "text-warning" : "text-muted")}>
      {lastUpdateBasis === "COMPUTED" ? "Computed" : "Updated"} {formatAge(dataAgeMs)} ago
    </span>
  );
}
