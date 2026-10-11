import type { Station } from "@/domain/metro";
import type { TrainState, TrainStatus } from "@/domain/trainsim";
import type { Tone } from "@/lib/ui/tone";

export const TRAIN_STATUS_TONE: Record<TrainStatus, Tone> = {
  SCHEDULED: "neutral",
  AT_STATION: "neutral",
  DWELLING: "neutral",
  DEPARTING: "positive",
  RUNNING: "positive",
  ARRIVING: "positive",
  STOPPED: "warning",
  DELAYED: "danger",
  COMPLETED: "neutral",
};

export const TRAIN_STATUS_LABEL: Record<TrainStatus, string> = {
  SCHEDULED: "Scheduled",
  AT_STATION: "At station",
  DWELLING: "Dwelling",
  DEPARTING: "Departing",
  RUNNING: "En route",
  ARRIVING: "Arriving",
  STOPPED: "Held",
  DELAYED: "Delayed",
  COMPLETED: "Completed",
};

function stationName(stationsById: ReadonlyMap<number, Station>, id: number): string {
  return stationsById.get(id)?.name ?? `#${id}`;
}

/** A human-readable description of where a train currently is, tailored to its status. */
export function describeTrainLocation(
  train: Pick<TrainState, "status" | "previousStationId" | "nextStationId" | "progress" | "scheduledDepartureSeconds">,
  stationsById: ReadonlyMap<number, Station>
): string {
  const prev = stationName(stationsById, train.previousStationId);
  const next = stationName(stationsById, train.nextStationId);

  switch (train.status) {
    case "SCHEDULED":
      return `Scheduled to depart ${prev}`;
    case "AT_STATION":
      return `At ${prev}`;
    case "DWELLING":
      return `Dwelling at ${prev}`;
    case "STOPPED":
    case "DELAYED":
      return `Held near ${prev}, waiting for the track ahead to clear`;
    case "COMPLETED":
      return `Completed its route at ${prev}`;
    case "DEPARTING":
    case "RUNNING":
    case "ARRIVING":
      return `Between ${prev} and ${next} (${Math.round(train.progress * 100)}%)`;
  }
}

/**
 * Null-aware readouts. A field a source can't know (passengers from a GTFS feed, delay from a
 * timetable) is `null`; these render it as unknown instead of letting it read as zero or on time.
 */
export function formatSpeed(speedKmph: number | null): string {
  return speedKmph == null ? "— km/h" : `${Math.round(speedKmph)} km/h`;
}

/** True only when the source reports a positive delay; unknown is not late. */
export function isLate(train: Pick<TrainState, "delaySeconds">): boolean {
  return train.delaySeconds != null && train.delaySeconds > 0;
}

/** "+2m 10s", "On time", or "Delay unknown" — formatted with the caller's duration formatter. */
export function formatDelay(
  train: Pick<TrainState, "delaySeconds">,
  formatDuration: (seconds: number) => string,
): string {
  if (train.delaySeconds == null) return "Delay unknown";
  return train.delaySeconds > 0 ? `+${formatDuration(train.delaySeconds)}` : "On time";
}

/**
 * Delay statistics over only the trains whose delay is known. `knownCount` 0 means "no delay
 * information at all" — callers show a dash, not a perfect on-time score.
 */
export function delayStats(trains: readonly Pick<TrainState, "delaySeconds">[]): {
  knownCount: number;
  delayedCount: number;
  totalDelaySeconds: number;
  maxDelaySeconds: number;
} {
  let knownCount = 0;
  let delayedCount = 0;
  let totalDelaySeconds = 0;
  let maxDelaySeconds = 0;
  for (const t of trains) {
    if (t.delaySeconds == null) continue;
    knownCount++;
    totalDelaySeconds += t.delaySeconds;
    maxDelaySeconds = Math.max(maxDelaySeconds, t.delaySeconds);
    if (t.delaySeconds > 0) delayedCount++;
  }
  return { knownCount, delayedCount, totalDelaySeconds, maxDelaySeconds };
}

export function hasOccupancy(
  train: Pick<TrainState, "passengerCount" | "capacity">,
): train is typeof train & { passengerCount: number; capacity: number } {
  return train.passengerCount != null && train.capacity != null;
}
