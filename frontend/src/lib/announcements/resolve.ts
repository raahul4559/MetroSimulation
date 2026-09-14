import type { AnnouncementData, LanguageCode } from "@/domain/announcement";
import { resolveStationSpeechName } from "@/config/stations/stationPronunciation";

/**
 * `AnnouncementData` with every station name swapped for that one language's correct spoken form —
 * what a template function actually reads. Built fresh per language (never cached across languages)
 * so a multilingual announcement's English pass and Hindi pass each get their own pronunciation,
 * never one language's script leaking into another's sentence.
 */
export interface ResolvedAnnouncementData {
  readonly stationName: string;
  readonly platform: number | null;
  readonly lineName: string;
  readonly destinationName: string;
  readonly nextStationName: string | null;
  readonly trainNumber: string;
  readonly delayMinutes: number;
  readonly transferLines: readonly string[] | null;
  readonly disruptionDescription: string | null;
}

export function resolveAnnouncementData(data: AnnouncementData, language: LanguageCode): ResolvedAnnouncementData {
  return {
    stationName: resolveStationSpeechName(data.stationCode, data.stationName, language),
    platform: data.platform,
    lineName: data.lineName,
    destinationName: resolveStationSpeechName(data.destinationStationCode, data.destinationStationName, language),
    nextStationName:
      data.nextStationName != null ? resolveStationSpeechName(data.nextStationCode, data.nextStationName, language) : null,
    trainNumber: data.trainNumber,
    delayMinutes: Math.max(1, Math.round(data.delaySeconds / 60)),
    transferLines: data.transferLines,
    disruptionDescription: data.disruptionDescription,
  };
}
