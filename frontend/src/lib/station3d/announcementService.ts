import type { PlatformLayout3D, StationLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import type { AnnouncementEvent, AnnouncementType } from "@/domain/announcement";

/**
 * Turns a real `TrainPhase3D` transition into the announcement(s) that transition implies — the
 * single source of announcement events for the 3D station, so nothing in `StationScene` ever
 * decides on its own that "now would be a good time to announce something." Compares this tick's
 * `current` visuals against `previous`'s last-seen snapshot (kept by the caller, see
 * `useStationAnnouncements`) purely to detect edges; it holds no state and runs no clock itself.
 *
 * A train that disappears from `current` after having been `DEPARTING` (rather than switching lines
 * or simply leaving the 3D window some other way) fires `NEXT_STATION`, using that last snapshot's
 * own real `nextStationName` — the announcement always describes where the train that just left is
 * actually headed, never a guess.
 */
export function deriveAnnouncements(
  previous: ReadonlyMap<number, TrainVisual3D>,
  current: readonly TrainVisual3D[],
  station: StationLayout3D
): AnnouncementEvent[] {
  const events: AnnouncementEvent[] = [];
  const platformsByLine = new Map(station.platforms.map((p) => [p.lineCode, p] as const));
  const currentIds = new Set(current.map((v) => v.trainId));

  for (const visual of current) {
    const prior = previous.get(visual.trainId);
    const platform = platformsByLine.get(visual.lineCode) ?? null;
    if (!prior) {
      if (visual.phase === "APPROACHING") {
        events.push(makeEvent("TRAIN_APPROACHING", visual, station, platform));
      }
      continue;
    }
    if (prior.phase === visual.phase) continue;

    for (const type of transitionEvents(prior.phase, visual.phase)) {
      events.push(makeEvent(type, visual, station, platform));
    }
  }

  for (const [trainId, prior] of previous) {
    if (currentIds.has(trainId)) continue;
    if (prior.phase === "DEPARTING") {
      events.push(makeEvent("NEXT_STATION", prior, station, platformsByLine.get(prior.lineCode) ?? null));
    }
  }

  return events;
}

function transitionEvents(from: TrainPhase3D, to: TrainPhase3D): readonly AnnouncementType[] {
  if (from === "APPROACHING" && to === "ARRIVING") return ["TRAIN_ARRIVING"];
  if (to === "STOPPED") return ["TRAIN_AT_PLATFORM"];
  if (to === "BOARDING") return ["DOORS_OPENING", "BOARDING"];
  if (from === "BOARDING" && to === "DEPARTING") return ["DOORS_CLOSING", "TRAIN_DEPARTING"];
  return [];
}

let sequence = 0;

function makeEvent(
  type: AnnouncementType,
  visual: TrainVisual3D,
  station: StationLayout3D,
  platform: PlatformLayout3D | null
): AnnouncementEvent {
  sequence += 1;
  return {
    id: `${visual.trainId}-${type}-${sequence}`,
    type,
    trainId: visual.trainId,
    trainCode: visual.code,
    station: station.name,
    platform: platform?.platformNumber ?? null,
    line: platform?.lineName ?? visual.lineCode,
    destination: visual.destinationStationName,
    nextStation: visual.nextStationName || null,
    message: buildMessage(type, visual, station, platform),
  };
}

function buildMessage(
  type: AnnouncementType,
  visual: TrainVisual3D,
  station: StationLayout3D,
  platform: PlatformLayout3D | null
): string {
  const platformPhrase = platform ? `Platform ${platform.platformNumber}` : "the platform";
  const destination = visual.destinationStationName || "its destination";

  switch (type) {
    case "TRAIN_APPROACHING":
      return `The train approaching ${platformPhrase} is heading towards ${destination}.`;
    case "TRAIN_ARRIVING":
      return `The train arriving at ${platformPhrase} is heading towards ${destination}.`;
    case "TRAIN_AT_PLATFORM":
      return `The train for ${destination} has arrived at ${platformPhrase}.`;
    case "DOORS_OPENING":
      return "Doors opening.";
    case "BOARDING":
      return `Please allow passengers to alight before boarding. This train is headed towards ${destination}.`;
    case "DOORS_CLOSING":
      return "The doors are closing. Please stand clear of the doors.";
    case "TRAIN_DEPARTING":
      return `This train is now departing ${station.name} for ${destination}.`;
    case "NEXT_STATION":
      return visual.nextStationName ? `Next station is ${visual.nextStationName}.` : "";
  }
}
