import type { PlatformLayout3D, StationLayout3D, TrainPhase3D, TrainVisual3D } from "@/domain/station3d";
import type { AnnouncementData, AnnouncementEvent, AnnouncementType } from "@/domain/announcement";
import { ANNOUNCEMENT_PRIORITY } from "@/domain/announcement";
import type { Disruption } from "@/domain/trainsim";

/** A train arriving with at least this much accumulated delay gets a spoken `DELAY` announcement on
 * top of its normal arrival sequence — short, routine delays aren't worth narrating and would just
 * add noise for something the on-screen delay readout already shows every tick. */
const DELAY_ANNOUNCEMENT_THRESHOLD_SECONDS = 90;

/**
 * Turns real `TrainPhase3D` transitions (plus real delay/interchange/disruption facts) into the
 * `AnnouncementEvent`s those transitions imply — the single source of announcement events for the 3D
 * station, so nothing in `StationScene` ever decides on its own that "now would be a good time to
 * announce something." Compares this tick's `current` visuals against `previous`'s last-seen
 * snapshot (kept by the caller, see `useStationAnnouncements`) purely to detect edges; it holds no
 * state and runs no clock itself. Builds structured `AnnouncementData`, never rendered text — text is
 * `AnnouncementService`'s job, one language at a time, via `lib/announcements/templates`.
 *
 * <p>A train that disappears from `current` after having been `DEPARTING` (rather than switching
 * lines or simply leaving the 3D window some other way) fires `NEXT_STATION`, using that last
 * snapshot's own real `nextStationName` — the announcement always describes where the train that just
 * left is actually headed, never a guess.
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
        events.push(makeTrainEvent("TRAIN_APPROACHING", visual, station, platform));
      }
      continue;
    }
    if (prior.phase === visual.phase) continue;

    for (const type of transitionEvents(prior.phase, visual.phase)) {
      events.push(makeTrainEvent(type, visual, station, platform));
    }

    if (visual.phase === "STOPPED") {
      if (visual.delaySeconds >= DELAY_ANNOUNCEMENT_THRESHOLD_SECONDS) {
        events.push(makeTrainEvent("DELAY", visual, station, platform));
      }
      const transferLines = otherLineNames(station, visual.lineCode);
      if (transferLines.length > 0) {
        events.push(makeTrainEvent("TRANSFER", visual, station, platform, { transferLines }));
      }
    }
  }

  for (const [trainId, prior] of previous) {
    if (currentIds.has(trainId)) continue;
    if (prior.phase === "DEPARTING" && prior.nextStationName) {
      events.push(makeTrainEvent("NEXT_STATION", prior, station, platformsByLine.get(prior.lineCode) ?? null));
    }
  }

  return events;
}

function otherLineNames(station: StationLayout3D, exceptLineCode: string): readonly string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const p of station.platforms) {
    if (p.lineCode === exceptLineCode || seen.has(p.lineCode)) continue;
    seen.add(p.lineCode);
    names.push(p.lineName);
  }
  return names;
}

function transitionEvents(from: TrainPhase3D, to: TrainPhase3D): readonly AnnouncementType[] {
  if (from === "APPROACHING" && to === "ARRIVING") return ["TRAIN_ARRIVING"];
  if (to === "STOPPED") return ["TRAIN_AT_PLATFORM"];
  if (to === "BOARDING") return ["DOORS_OPENING", "BOARDING"];
  if (from === "BOARDING" && to === "DEPARTING") return ["SAFETY", "DOORS_CLOSING", "TRAIN_DEPARTING"];
  return [];
}

let sequence = 0;

function makeTrainEvent(
  type: AnnouncementType,
  visual: TrainVisual3D,
  station: StationLayout3D,
  platform: PlatformLayout3D | null,
  extra?: Partial<Pick<AnnouncementData, "transferLines" | "disruptionDescription">>
): AnnouncementEvent {
  sequence += 1;
  const data: AnnouncementData = {
    stationCode: station.code,
    stationName: station.name,
    platform: platform?.platformNumber ?? null,
    lineCode: platform?.lineCode ?? visual.lineCode,
    lineName: platform?.lineName ?? visual.lineCode,
    destinationStationCode: visual.destinationStationCode,
    destinationStationName: visual.destinationStationName || "its destination",
    nextStationCode: visual.nextStationCode,
    nextStationName: visual.nextStationName || null,
    trainNumber: visual.code,
    direction: visual.direction,
    delaySeconds: visual.delaySeconds,
    transferLines: extra?.transferLines ?? null,
    disruptionDescription: extra?.disruptionDescription ?? null,
    disruptionType: null,
  };
  return {
    id: `${visual.trainId}-${type}-${sequence}`,
    type,
    priority: ANNOUNCEMENT_PRIORITY[type],
    trainId: visual.trainId,
    data,
  };
}

/**
 * Turns active `STATION`-scoped disruptions affecting this exact station into `SERVICE_DISRUPTION`
 * events — one per disruption, fired once on the real edge where it becomes active (never repeated
 * every tick while it stays active, never fired for a disruption that started before this station was
 * opened). `TRAIN`/`TRACK`-scoped disruptions aren't announced here: without real track topology this
 * derivation can't reliably say *this* station is affected by *that* track segment, and a wrong guess
 * is worse than staying quiet.
 */
export function deriveDisruptionAnnouncements(
  station: StationLayout3D,
  disruptions: readonly Disruption[],
  previousActiveIds: ReadonlySet<number>
): { events: readonly AnnouncementEvent[]; activeIds: ReadonlySet<number> } {
  const relevant = disruptions.filter(
    (d) => d.status === "ACTIVE" && d.resourceType === "STATION" && d.resourceId === station.stationId
  );
  const activeIds = new Set(relevant.map((d) => d.id));
  const events: AnnouncementEvent[] = [];

  for (const disruption of relevant) {
    if (previousActiveIds.has(disruption.id)) continue;
    sequence += 1;
    events.push({
      id: `disruption-${disruption.id}-${sequence}`,
      type: "SERVICE_DISRUPTION",
      priority: ANNOUNCEMENT_PRIORITY.SERVICE_DISRUPTION,
      trainId: null,
      data: {
        stationCode: station.code,
        stationName: station.name,
        platform: null,
        lineCode: "",
        lineName: "",
        destinationStationCode: null,
        destinationStationName: "",
        nextStationCode: null,
        nextStationName: null,
        trainNumber: "",
        direction: "OUTBOUND",
        delaySeconds: 0,
        transferLines: null,
        disruptionDescription: disruption.description || null,
        disruptionType: disruption.type,
      },
    });
  }

  return { events, activeIds };
}
