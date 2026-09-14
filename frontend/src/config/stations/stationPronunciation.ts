import type { LanguageCode } from "@/domain/announcement";

/**
 * Pronunciation metadata for stations this network's PA announces — kept entirely separate from
 * `displayName` (what the UI prints) because the two can legitimately differ: a station's accurate
 * printed name is not always what a natural announcement should say out loud in every language (a
 * bracketed alternate name, a long formal name, a spelling that a given language's TTS mispronounces).
 * `displayName` here is never used for rendering — the 2D map/3D station/panels all read the real
 * `Station.name` from network data; this only supplies *speech* text for
 * `lib/announcements/templates` to embed, one language at a time, never mixed.
 *
 * Curated by station `code` (the same code `data/metro/stations.json` and `Station.code` use).
 * `kannadaSpeechName`/`hindiSpeechName` are written in native script on purpose — feeding
 * transliterated (Latin-script) Kannada or Hindi into a language-tagged voice produces exactly the
 * "foreign-accented" reading the spec calls out; native script lets the browser's own hi-IN/kn-IN
 * voice apply its real pronunciation rules.
 */
export interface StationPronunciation {
  readonly code: string;
  readonly displayName: string;
  readonly englishSpeechName: string;
  readonly hindiSpeechName: string;
  readonly kannadaSpeechName: string;
}

const STATION_PRONUNCIATIONS: Readonly<Record<string, StationPronunciation>> = index([
  {
    code: "KENGERI",
    displayName: "Kengeri",
    englishSpeechName: "Kengeri",
    hindiSpeechName: "केंगेरी",
    kannadaSpeechName: "ಕೆಂಗೇರಿ",
  },
  {
    code: "NAYANDAHALLI",
    displayName: "Nayandahalli",
    englishSpeechName: "Nayandahalli",
    hindiSpeechName: "नयनदहल्ली",
    kannadaSpeechName: "ನಾಯಂಡಹಳ್ಳಿ",
  },
  {
    code: "VIJAYANAGAR",
    displayName: "Vijayanagar",
    englishSpeechName: "Vijayanagar",
    hindiSpeechName: "विजयनगर",
    kannadaSpeechName: "ವಿಜಯನಗರ",
  },
  {
    code: "MAGADI_ROAD",
    displayName: "Magadi Road",
    englishSpeechName: "Magadi Road",
    hindiSpeechName: "मागडी रोड",
    kannadaSpeechName: "ಮಾಗಡಿ ರಸ್ತೆ",
  },
  {
    code: "MAJESTIC",
    displayName: "Nadaprabhu Kempegowda Station",
    englishSpeechName: "Nadaprabhu Kempegowda Station, Majestic",
    hindiSpeechName: "नादप्रभु केम्पेगौड़ा स्टेशन, मैजेस्टिक",
    kannadaSpeechName: "ನಾಡಪ್ರಭು ಕೆಂಪೇಗೌಡ ನಿಲ್ದಾಣ, ಮೆಜೆಸ್ಟಿಕ್",
  },
  {
    code: "MG_ROAD",
    displayName: "MG Road",
    englishSpeechName: "M G Road",
    hindiSpeechName: "एम जी रोड",
    kannadaSpeechName: "ಎಂ ಜಿ ರಸ್ತೆ",
  },
  {
    code: "INDIRANAGAR",
    displayName: "Indiranagar",
    englishSpeechName: "Indiranagar",
    hindiSpeechName: "इंदिरानगर",
    kannadaSpeechName: "ಇಂದಿರಾನಗರ",
  },
  {
    code: "BAIYAPPANAHALLI",
    displayName: "Baiyappanahalli",
    englishSpeechName: "Baiyappanahalli",
    hindiSpeechName: "बैयप्पनहल्ली",
    kannadaSpeechName: "ಬಾಯಪ್ಪನಹಳ್ಳಿ",
  },
  {
    code: "WHITEFIELD",
    displayName: "Whitefield (Kadugodi)",
    englishSpeechName: "Whitefield",
    hindiSpeechName: "व्हाइटफील्ड",
    kannadaSpeechName: "ವೈಟ್‌ಫೀಲ್ಡ್",
  },
  {
    code: "NAGASANDRA",
    displayName: "Nagasandra",
    englishSpeechName: "Nagasandra",
    hindiSpeechName: "नागसंद्रा",
    kannadaSpeechName: "ನಾಗಸಂದ್ರ",
  },
  {
    code: "YESHWANTPUR",
    displayName: "Yeshwantpur",
    englishSpeechName: "Yeshwantpur",
    hindiSpeechName: "यशवंतपुर",
    kannadaSpeechName: "ಯಶವಂತಪುರ",
  },
  {
    code: "MAHALAKSHMI",
    displayName: "Mahalakshmi",
    englishSpeechName: "Mahalakshmi",
    hindiSpeechName: "महालक्ष्मी",
    kannadaSpeechName: "ಮಹಾಲಕ್ಷ್ಮಿ",
  },
  {
    code: "LALBAGH",
    displayName: "Lalbagh",
    englishSpeechName: "Lalbagh",
    hindiSpeechName: "लालबाग",
    kannadaSpeechName: "ಲಾಲ್‌ಬಾಗ್",
  },
  {
    code: "JAYANAGAR",
    displayName: "Jayanagar",
    englishSpeechName: "Jayanagar",
    hindiSpeechName: "जयनगर",
    kannadaSpeechName: "ಜಯನಗರ",
  },
  {
    code: "RV_ROAD",
    displayName: "RV Road",
    englishSpeechName: "R V Road",
    hindiSpeechName: "आर वी रोड",
    kannadaSpeechName: "ಆರ್ ವಿ ರಸ್ತೆ",
  },
  {
    code: "YELACHENAHALLI",
    displayName: "Yelachenahalli",
    englishSpeechName: "Yelachenahalli",
    hindiSpeechName: "येलचेनहल्ली",
    kannadaSpeechName: "ಯಲಚೇನಹಳ್ಳಿ",
  },
  {
    code: "JAYADEVA_HOSPITAL",
    displayName: "Jayadeva Hospital",
    englishSpeechName: "Jayadeva Hospital",
    hindiSpeechName: "जयदेव अस्पताल",
    kannadaSpeechName: "ಜಯದೇವ ಆಸ್ಪತ್ರೆ",
  },
  {
    code: "CENTRAL_SILK_BOARD",
    displayName: "Central Silk Board",
    englishSpeechName: "Silk Board Junction",
    hindiSpeechName: "सिल्क बोर्ड जंक्शन",
    kannadaSpeechName: "ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಜಂಕ್ಷನ್",
  },
  {
    code: "ELECTRONIC_CITY",
    displayName: "Electronic City",
    englishSpeechName: "Electronic City",
    hindiSpeechName: "इलेक्ट्रॉनिक सिटी",
    kannadaSpeechName: "ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ",
  },
  {
    code: "HEBBAGODI",
    displayName: "Hebbagodi",
    englishSpeechName: "Hebbagodi",
    hindiSpeechName: "हेब्बागोडी",
    kannadaSpeechName: "ಹೆಬ್ಬಗೋಡಿ",
  },
  {
    code: "BOMMASANDRA",
    displayName: "Bommasandra",
    englishSpeechName: "Bommasandra",
    hindiSpeechName: "बोम्मसंद्रा",
    kannadaSpeechName: "ಬೊಮ್ಮಸಂದ್ರ",
  },
]);

function index(entries: readonly StationPronunciation[]): Record<string, StationPronunciation> {
  const map: Record<string, StationPronunciation> = {};
  for (const entry of entries) map[entry.code] = entry;
  return map;
}

/**
 * Resolves the text a given language's voice should actually say for a station — the curated entry
 * when one exists; otherwise the real display `name` passed in, so an as-yet-uncurated station (see
 * {@link listCuratedStationPronunciations}) still announces something correct in English and a
 * best-effort (if accented) reading in Hindi/Kannada rather than silently failing. Callers should
 * pass the real `Station.code`/`Station.name` from network data, never a literal.
 */
export function resolveStationSpeechName(code: string | null, fallbackName: string, language: LanguageCode): string {
  const entry = code ? STATION_PRONUNCIATIONS[code] : undefined;
  if (!entry) return fallbackName;
  switch (language) {
    case "en":
      return entry.englishSpeechName;
    case "hi":
      return entry.hindiSpeechName;
    case "kn":
      return entry.kannadaSpeechName;
  }
}

/** Every curated entry — for a future "N stations pronounced" validation view, never used by the
 * announcement render path itself, which always goes through {@link resolveStationSpeechName}. */
export function listCuratedStationPronunciations(): readonly StationPronunciation[] {
  return Object.values(STATION_PRONUNCIATIONS);
}
