import type { Station } from "@/domain/metro";
import type { RealtimeAlert, ServiceStatus } from "@/domain/realtime";
import type { Disruption } from "@/domain/trainsim";
import type { Tone } from "@/lib/ui/tone";

/**
 * A station's status, derived from what the server reports: its lines' operating status (IST
 * timetable + exceptions + observed trains), realtime alerts naming the station or its lines, and —
 * under the simulation — injected disruptions at the station. Nothing here is assumed: with no
 * status yet it says so rather than defaulting to "operational".
 */
export interface StationStatus {
  readonly label: string;
  readonly tone: Tone;
  /** Where the status came from, for a tooltip or a caption. */
  readonly detail: string;
}

const SEVERITY_RANK = { MINOR: 0, MODERATE: 1, MAJOR: 2, SEVERE: 3 } as const;

export function deriveStationStatus(
  station: Pick<Station, "id" | "lines">,
  service: ServiceStatus | null,
  alerts: readonly RealtimeAlert[],
  disruptions: readonly Disruption[],
): StationStatus {
  const stationAlerts = alerts.filter(
    (a) => a.stationIds.includes(station.id) || a.lineCodes.some((code) => station.lines.includes(code)),
  );
  if (stationAlerts.length > 0) {
    const severe = stationAlerts.some((a) => a.severity === "SEVERE");
    const first = stationAlerts[0]!;
    return {
      label: severe ? "Disrupted" : "Service alert",
      tone: severe ? "danger" : "warning",
      detail: first.headerText ?? first.descriptionText ?? "Realtime service alert",
    };
  }

  const stationDisruptions = disruptions.filter(
    (d) => d.status === "ACTIVE" && d.resourceType === "STATION" && d.resourceId === station.id,
  );
  if (stationDisruptions.length > 0) {
    const worst = stationDisruptions.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
    return {
      label: "Disrupted",
      tone: SEVERITY_RANK[worst.severity] >= SEVERITY_RANK.MAJOR ? "danger" : "warning",
      detail: worst.description || "Simulated disruption at this station",
    };
  }

  if (!service) return { label: "Status unknown", tone: "neutral", detail: "Waiting for operating status." };

  const lineStates = service.lines.filter((l) => station.lines.includes(l.lineCode));
  if (lineStates.length === 0) {
    return { label: "Status unknown", tone: "neutral", detail: "No operating status for this station's lines." };
  }
  const has = (s: string) => lineStates.some((l) => l.state === s);
  const basis = service.timetableConfigured ? "From the published timetable (IST)" : "No timetable configured";

  if (has("SUSPENDED")) return { label: "Suspended", tone: "danger", detail: reasonOf(lineStates, "SUSPENDED") ?? basis };
  if (has("DISRUPTED")) return { label: "Disrupted", tone: "warning", detail: reasonOf(lineStates, "DISRUPTED") ?? basis };
  if (has("OPERATING")) return { label: "In service", tone: "positive", detail: basis };
  if (has("NOT_STARTED")) {
    const first = lineStates
      .map((l) => l.firstDeparture)
      .filter((t): t is string => t != null)
      .sort()[0];
    return { label: first ? `Opens ${first}` : "Not yet open", tone: "neutral", detail: basis };
  }
  if (lineStates.every((l) => l.state === "ENDED")) {
    return { label: "Closed for the night", tone: "neutral", detail: basis };
  }
  return { label: "Status unknown", tone: "neutral", detail: basis };
}

function reasonOf(lines: ServiceStatus["lines"], state: string): string | null {
  return lines.find((l) => l.state === state)?.reason ?? null;
}
