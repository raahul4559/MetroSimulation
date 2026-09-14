import type { Passenger, PassengerStatus } from "@/domain/trainsim";

type Tone = "neutral" | "positive" | "warning" | "danger";

export const PASSENGER_STATUS_LABEL: Record<PassengerStatus, string> = {
  WAITING: "Waiting",
  BOARDING: "Boarding",
  ON_TRAIN: "On train",
  ALIGHTING: "Alighting",
  TRANSFER: "Transferring",
  COMPLETED: "Completed",
};

export const PASSENGER_STATUS_TONE: Record<PassengerStatus, Tone> = {
  WAITING: "neutral",
  BOARDING: "positive",
  ON_TRAIN: "positive",
  ALIGHTING: "warning",
  TRANSFER: "warning",
  COMPLETED: "neutral",
};

/** A passenger is "at a station, waiting for a train" — as opposed to riding one — in both the
 * `WAITING` (first leg) and `TRANSFER` (between legs) states. */
function isWaitingAtStation(passenger: Passenger): boolean {
  return passenger.status === "WAITING" || passenger.status === "TRANSFER";
}

/** Station id -> count of passengers currently waiting there, for every station with at least one.
 * Built once per render from the full passenger roster, not recomputed per station marker. */
export function buildStationQueueCounts(passengers: readonly Passenger[]): ReadonlyMap<number, number> {
  const counts = new Map<number, number>();
  for (const p of passengers) {
    if (isWaitingAtStation(p) && p.currentStationId != null) {
      counts.set(p.currentStationId, (counts.get(p.currentStationId) ?? 0) + 1);
    }
  }
  return counts;
}

export function getStationQueue(passengers: readonly Passenger[], stationId: number): Passenger[] {
  return passengers.filter((p) => isWaitingAtStation(p) && p.currentStationId === stationId);
}

export type DensityLevel = "low" | "moderate" | "high" | "crowded";

const DENSITY_THRESHOLDS: readonly [number, DensityLevel][] = [
  [10, "low"],
  [30, "moderate"],
  [75, "high"],
];

/** Bucket a raw waiting-passenger count into a coarse density level — the map/marker visuals care
 * about "is this station backing up," not the exact headcount. */
export function densityLevel(waitingCount: number): DensityLevel {
  for (const [max, level] of DENSITY_THRESHOLDS) {
    if (waitingCount <= max) return level;
  }
  return "crowded";
}

export const DENSITY_LABEL: Record<DensityLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  crowded: "Crowded",
};

export const DENSITY_TONE: Record<DensityLevel, Tone> = {
  low: "positive",
  moderate: "neutral",
  high: "warning",
  crowded: "danger",
};

export const DENSITY_COLOR: Record<DensityLevel, string> = {
  low: "#34d399",
  moderate: "#94a3b8",
  high: "#fbbf24",
  crowded: "#f87171",
};

export function occupancyRatio(count: number, capacity: number): number {
  return capacity > 0 ? Math.min(1, count / capacity) : 0;
}

export function occupancyTone(count: number, capacity: number): Tone {
  const ratio = occupancyRatio(count, capacity);
  if (ratio >= 0.9) return "danger";
  if (ratio >= 0.6) return "warning";
  return "positive";
}

export function formatOccupancyPercent(count: number, capacity: number): string {
  return `${(occupancyRatio(count, capacity) * 100).toFixed(1)}%`;
}

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `${Math.round(seconds)}s`;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
