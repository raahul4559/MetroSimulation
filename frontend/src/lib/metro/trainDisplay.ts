import type { Station } from "@/domain/metro";
import type { TrainState, TrainStatus } from "@/domain/trainsim";

type Tone = "neutral" | "positive" | "warning" | "danger";

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
