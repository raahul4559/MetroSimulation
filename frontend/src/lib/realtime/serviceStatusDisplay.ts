import type { ServiceState, ServiceStatus } from "@/domain/realtime";
import type { Tone } from "@/lib/ui/tone";
import { formatIstHourMinute, formatIstShortDate, istDateKey } from "./serverClock";

/**
 * How the operating status reads on screen. Everything here is derived from the server's
 * `ServiceStatus` — the browser never decides whether the metro is running, and never fills in a
 * time the timetable didn't give.
 */

export const NETWORK_STATUS_LABEL: Record<ServiceState, string> = {
  OPERATING: "Service active",
  NOT_STARTED: "Service not started",
  ENDED: "Service ended",
  SUSPENDED: "Service suspended",
  DISRUPTED: "Service disrupted",
  UNKNOWN: "Status unknown",
};

export const LINE_STATUS_LABEL: Record<ServiceState, string> = {
  OPERATING: "Running",
  NOT_STARTED: "Not started",
  ENDED: "Ended",
  SUSPENDED: "Suspended",
  DISRUPTED: "Disrupted",
  UNKNOWN: "Unknown",
};

export const SERVICE_TONE: Record<ServiceState, Tone> = {
  OPERATING: "positive",
  NOT_STARTED: "neutral",
  ENDED: "neutral",
  SUSPENDED: "danger",
  DISRUPTED: "warning",
  UNKNOWN: "neutral",
};

/** States where "when does it run next?" is the useful question. */
const SHOWS_NEXT_SERVICE: ReadonlySet<ServiceState> = new Set(["NOT_STARTED", "ENDED", "SUSPENDED"]);

/**
 * "05:00 IST", or "Tue, 20 Oct · 05:00 IST" when it is later than tomorrow (IST calendar) — but
 * only when the network isn't running and the timetable actually gave a next service. Null
 * otherwise; the UI then shows no time at all.
 */
export function nextServiceText(service: ServiceStatus, serverNowMs: number): string | null {
  if (!SHOWS_NEXT_SERVICE.has(service.state) || !service.nextServiceAt) return null;
  const at = Date.parse(service.nextServiceAt);
  if (!Number.isFinite(at)) return null;
  const time = `${formatIstHourMinute(at)} IST`;
  const today = istDateKey(serverNowMs);
  const tomorrow = istDateKey(serverNowMs + 24 * 3_600_000);
  const day = istDateKey(at);
  return day === today || day === tomorrow ? time : `${formatIstShortDate(at)} · ${time}`;
}

/** The last scheduled departure of today's service day, while service is running or still to start. */
export function lastServiceText(service: ServiceStatus): string | null {
  if (!service.lastDepartureAt || service.state === "ENDED" || service.state === "UNKNOWN") return null;
  const at = Date.parse(service.lastDepartureAt);
  return Number.isFinite(at) ? `${formatIstHourMinute(at)} IST` : null;
}

/** One line explaining an UNKNOWN status, so it never looks like an outage. */
export function unknownExplanation(service: ServiceStatus): string | null {
  if (service.state !== "UNKNOWN") return null;
  return service.timetableConfigured
    ? "No timetable for today's service day"
    : "Operating hours not configured";
}
