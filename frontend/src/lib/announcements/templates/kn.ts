import type { AnnouncementType } from "@/domain/announcement";
import type { ResolvedAnnouncementData } from "../resolve";

/**
 * Natural Bengaluru/Karnataka-Kannada metro PA phrasing, written independently for each
 * `AnnouncementType` in native Kannada script — never a runtime translation of `en.ts`, and never
 * transliterated Latin-script Kannada (which reads as Hindi-accented Kannada to a kn-IN voice; see
 * the spec's own warning against exactly that). Line names (e.g. "Purple Line") stay in their real
 * English brand form even inside a Kannada sentence, matching Namma Metro's own announcements.
 */
export function buildKannadaText(type: AnnouncementType, d: ResolvedAnnouncementData): string {
  const platformPhrase = d.platform != null ? `ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ${d.platform}` : "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್";

  switch (type) {
    case "TRAIN_APPROACHING":
      return `ಗಮನಿಸಿ. ${platformPhrase} ಗೆ ಬರುತ್ತಿರುವ ರೈಲು ${d.destinationName} ಕಡೆಗೆ ಹೋಗಲಿದೆ.`;
    case "TRAIN_ARRIVING":
      return `${d.destinationName} ಗೆ ಹೋಗುವ ರೈಲು ಈಗ ಬರುತ್ತಿದೆ.`;
    case "TRAIN_AT_PLATFORM":
      return `${d.destinationName} ಗೆ ಹೋಗುವ ರೈಲು ${platformPhrase} ಗೆ ಬಂದಿದೆ.`;
    case "DOORS_OPENING":
      return "ಬಾಗಿಲುಗಳು ತೆರೆಯುತ್ತಿವೆ.";
    case "BOARDING":
      return `ದಯವಿಟ್ಟು ಮೊದಲು ಪ್ರಯಾಣಿಕರನ್ನು ಇಳಿಯಲು ಬಿಡಿ, ನಂತರ ಹತ್ತಿರಿ. ಇದು ${d.lineName} ನ ${d.destinationName} ರೈಲು.`;
    case "DOORS_CLOSING":
      return "ಬಾಗಿಲುಗಳು ಮುಚ್ಚುತ್ತಿವೆ.";
    case "SAFETY":
      return "ದಯವಿಟ್ಟು ಬಾಗಿಲುಗಳಿಂದ ದೂರವಿರಿ.";
    case "TRAIN_DEPARTING":
      return `ಈ ರೈಲು ಈಗ ${d.stationName} ನಿಂದ ${d.destinationName} ಕಡೆಗೆ ಹೊರಡುತ್ತಿದೆ.`;
    case "NEXT_STATION":
      return `ಮುಂದಿನ ನಿಲ್ದಾಣ ${d.nextStationName ?? "ಕೊನೆಯ ನಿಲ್ದಾಣ"}.`;
    case "TRANSFER":
      return `ಇಲ್ಲಿ ${joinNatural(d.transferLines)} ಗೆ ಇಂಟರ್‌ಚೇಂಜ್ ಲಭ್ಯವಿದೆ.`;
    case "DELAY":
      return `ಈ ಸೇವೆಯಲ್ಲಿ ಸುಮಾರು ${d.delayMinutes} ನಿಮಿಷ ವಿಳಂಬವಾಗಿರುವುದಕ್ಕೆ ವಿಷಾದಿಸುತ್ತೇವೆ. ದಯವಿಟ್ಟು ಸಹಕರಿಸಿ.`;
    case "SERVICE_DISRUPTION":
      return `ಗಮನಿಸಿ. ${d.disruptionDescription ?? "ಈ ಮಾರ್ಗದಲ್ಲಿ ಸೇವಾ ವ್ಯತ್ಯಯ ಉಂಟಾಗಿದೆ."} ದಯವಿಟ್ಟು ನಿಲ್ದಾಣ ಸಿಬ್ಬಂದಿಯ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.`;
  }
}

function joinNatural(items: readonly string[] | null): string {
  if (!items || items.length === 0) return "ಇತರ ಮಾರ್ಗಗಳಿಗೆ";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ಮತ್ತು ${items[items.length - 1]}`;
}
