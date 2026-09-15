import type { AnnouncementType } from "@/domain/announcement";
import type { DisruptionType } from "@/domain/trainsim";
import type { ResolvedAnnouncementData } from "../resolve";

/** What happened, in one clause, per {@link DisruptionType} — the structured fallback used whenever
 * an operator hasn't supplied (or overridden) free-text `disruptionDescription`. English is the one
 * language allowed to prefer the free-text description instead (see `buildEnglishText` below),
 * since that text is always operator-authored English by design. */
export const disruptionTypeTemplates: Record<DisruptionType, string> = {
  TRAIN_FAILURE: "a train has developed a technical fault",
  SIGNAL_FAILURE: "a signal fault is affecting this line",
  STATION_CONGESTION: "this station is experiencing heavy congestion",
  TRACK_BLOCKAGE: "the track ahead is temporarily blocked",
  EXTENDED_DWELL: "a train ahead is being held longer than usual",
  CUSTOM_DELAY: "services on this line are running with delays",
};

/**
 * Natural Indian-English metro PA phrasing, one sentence (or two) per `AnnouncementType`. Written
 * directly in English — not derived from another language — the same standard every other
 * `templates/*.ts` file follows, so no language here is ever "the real one others are translated
 * from."
 */
export function buildEnglishText(type: AnnouncementType, d: ResolvedAnnouncementData): string {
  const platformPhrase = d.platform != null ? `platform ${d.platform}` : "the platform";

  switch (type) {
    case "TRAIN_APPROACHING":
      return `Attention please. The train arriving on ${platformPhrase} is bound for ${d.destinationName}.`;
    case "TRAIN_ARRIVING":
      return `The train for ${d.destinationName} is now arriving.`;
    case "TRAIN_AT_PLATFORM":
      return `The train for ${d.destinationName} has arrived at ${platformPhrase}.`;
    case "DOORS_OPENING":
      return "Doors opening.";
    case "BOARDING":
      return `Please allow passengers to alight before boarding. This is the ${d.lineName} train to ${d.destinationName}.`;
    case "DOORS_CLOSING":
      return "The doors are closing.";
    case "SAFETY":
      return "Please stand clear of the doors.";
    case "TRAIN_DEPARTING":
      return `This train is now leaving ${d.stationName} for ${d.destinationName}.`;
    case "NEXT_STATION":
      return `The next station is ${d.nextStationName ?? "the terminus"}.`;
    case "TRANSFER":
      return `Interchange available here for ${joinNatural(d.transferLines)}.`;
    case "DELAY":
      return `We regret the delay of approximately ${d.delayMinutes} minute${d.delayMinutes === 1 ? "" : "s"} to this service. Thank you for your patience.`;
    case "SERVICE_DISRUPTION": {
      const cause = d.disruptionDescription ?? disruptionCauseSentence(d.disruptionType);
      return `Attention please. ${cause} Please follow instructions from station staff.`;
    }
  }
}

function joinNatural(items: readonly string[] | null): string {
  if (!items || items.length === 0) return "other lines";
  if (items.length === 1) return items[0]!;
  const last = items[items.length - 1]!;
  return `${items.slice(0, -1).join(", ")} and ${last}`;
}

/** A capitalized, period-terminated sentence describing why service is disrupted — used whenever
 * there's no operator-authored `disruptionDescription` to speak instead. */
function disruptionCauseSentence(type: DisruptionType | null): string {
  const clause = type ? disruptionTypeTemplates[type] : "there is a service disruption on this line";
  return `${clause[0]!.toUpperCase()}${clause.slice(1)}.`;
}
