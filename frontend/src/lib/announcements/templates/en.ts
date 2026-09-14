import type { AnnouncementType } from "@/domain/announcement";
import type { ResolvedAnnouncementData } from "../resolve";

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
    case "SERVICE_DISRUPTION":
      return `Attention please. ${d.disruptionDescription ?? "There is a service disruption on this line."} Please follow instructions from station staff.`;
  }
}

function joinNatural(items: readonly string[] | null): string {
  if (!items || items.length === 0) return "other lines";
  if (items.length === 1) return items[0]!;
  const last = items[items.length - 1]!;
  return `${items.slice(0, -1).join(", ")} and ${last}`;
}
