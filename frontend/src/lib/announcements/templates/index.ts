import type { AnnouncementData, AnnouncementType, LanguageCode } from "@/domain/announcement";
import { resolveAnnouncementData } from "../resolve";
import { buildEnglishText } from "./en";
import { buildHindiText } from "./hi";
import { buildKannadaText } from "./kn";

/**
 * The one place that turns real `AnnouncementData` into spoken text for a given language — every
 * consumer (`AnnouncementQueue`, captions) goes through this rather than reaching into
 * `templates/en.ts` etc. directly, so adding a language later means adding one case here plus one
 * new `templates/<lang>.ts` file, nothing else.
 */
export function buildAnnouncementText(type: AnnouncementType, data: AnnouncementData, language: LanguageCode): string {
  const resolved = resolveAnnouncementData(data, language);
  switch (language) {
    case "en":
      return buildEnglishText(type, resolved);
    case "hi":
      return buildHindiText(type, resolved);
    case "kn":
      return buildKannadaText(type, resolved);
  }
}
