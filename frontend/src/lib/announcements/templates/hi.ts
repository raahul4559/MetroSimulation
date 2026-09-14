import type { AnnouncementType } from "@/domain/announcement";
import type { ResolvedAnnouncementData } from "../resolve";

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
    case "SERVICE_DISRUPTION":
      return `कृपया ध्यान दें। ${d.disruptionDescription ?? "इस लाइन पर सेवा बाधित है।"} कृपया स्टेशन कर्मचारियों के निर्देशों का पालन करें।`;
  }
}

function joinNatural(items: readonly string[] | null): string {
  if (!items || items.length === 0) return "अन्य लाइनों";
  if (items.length === 1) return items[0]!;
  const last = items[items.length - 1]!;
  return `${items.slice(0, -1).join(", ")} और ${last}`;
}
