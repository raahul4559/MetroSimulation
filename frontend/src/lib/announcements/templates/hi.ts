import type { AnnouncementType } from "@/domain/announcement";
import type { DisruptionType } from "@/domain/trainsim";
import type { ResolvedAnnouncementData } from "../resolve";

/** Native-Hindi phrasing per {@link DisruptionType} — the *only* source for a Hindi
 * `SERVICE_DISRUPTION` sentence. `disruptionDescription` is always operator-authored English free
 * text; interpolating it here would read as English words dropped into a Hindi sentence, exactly
 * what the spec's "no Hindi pronunciation generated from an English voice" warning is about, so it
 * is never used in this file. */
const disruptionTypeTemplates: Record<DisruptionType, string> = {
  TRAIN_FAILURE: "एक ट्रेन में तकनीकी खराबी आ गई है",
  SIGNAL_FAILURE: "इस लाइन पर सिग्नल में खराबी है",
  STATION_CONGESTION: "इस स्टेशन पर अत्यधिक भीड़ है",
  TRACK_BLOCKAGE: "आगे की पटरी अस्थायी रूप से अवरुद्ध है",
  EXTENDED_DWELL: "आगे एक ट्रेन को सामान्य से अधिक समय के लिए रोका गया है",
  CUSTOM_DELAY: "इस लाइन पर सेवाएं देरी से चल रही हैं",
};

/**
 * Natural Indian-Hindi metro PA phrasing (the register Delhi/Namma Metro's own Hindi announcements
 * use), written independently for each `AnnouncementType` — never a runtime word-for-word
 * translation of `en.ts`. Line names (e.g. "Purple Line") are kept as their real English brand name
 * even inside a Hindi sentence, matching how Indian metro systems actually announce them.
 */
export function buildHindiText(type: AnnouncementType, d: ResolvedAnnouncementData): string {
  const platformPhrase = d.platform != null ? `प्लेटफ़ॉर्म ${d.platform}` : "प्लेटफ़ॉर्म";

  switch (type) {
    case "TRAIN_APPROACHING":
      return `कृपया ध्यान दें। ${platformPhrase} पर आ रही ट्रेन ${d.destinationName} की ओर जाएगी।`;
    case "TRAIN_ARRIVING":
      return `${d.destinationName} जाने वाली ट्रेन अब आ रही है।`;
    case "TRAIN_AT_PLATFORM":
      return `${d.destinationName} जाने वाली ट्रेन ${platformPhrase} पर आ चुकी है।`;
    case "DOORS_OPENING":
      return "दरवाज़े खुल रहे हैं।";
    case "BOARDING":
      return `कृपया पहले यात्रियों को उतरने दें, उसके बाद चढ़ें। यह ${d.lineName} की ट्रेन ${d.destinationName} जाएगी।`;
    case "DOORS_CLOSING":
      return "दरवाज़े बंद हो रहे हैं।";
    case "SAFETY":
      return "कृपया दरवाज़ों से दूर रहें।";
    case "TRAIN_DEPARTING":
      return `यह ट्रेन अब ${d.stationName} से ${d.destinationName} के लिए रवाना हो रही है।`;
    case "NEXT_STATION":
      return `अगला स्टेशन ${d.nextStationName ?? "अंतिम स्टेशन"} है।`;
    case "TRANSFER":
      return `यहाँ ${joinNatural(d.transferLines)} के लिए इंटरचेंज उपलब्ध है।`;
    case "DELAY":
      return `इस सेवा में लगभग ${d.delayMinutes} मिनट की देरी के लिए हमें खेद है। कृपया धैर्य बनाए रखें।`;
    case "SERVICE_DISRUPTION": {
      const cause = d.disruptionType ? disruptionTypeTemplates[d.disruptionType] : "इस लाइन पर सेवा बाधित है";
      return `कृपया ध्यान दें। ${cause}। कृपया स्टेशन कर्मचारियों के निर्देशों का पालन करें।`;
    }
  }
}

function joinNatural(items: readonly string[] | null): string {
  if (!items || items.length === 0) return "अन्य लाइनों";
  if (items.length === 1) return items[0]!;
  const last = items[items.length - 1]!;
  return `${items.slice(0, -1).join(", ")} और ${last}`;
}
