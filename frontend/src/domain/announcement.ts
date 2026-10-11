import type { TrainDirection } from "./trainsim/trainState";
import type { DisruptionType } from "./trainsim/disruption";

/**
 * A station-announcement trigger — always fired off a real transition or a real state fact in the
 * canonical realtime frame (a `TrainPhase3D` edge, an active `Disruption`, a realtime alert, a
 * delayed `TrainState`; see `lib/station3d/announcementService.ts`), never on a timer or user action
 * of its own. `AnnouncementService` is the only consumer of the *text* this produces; this type
 * itself carries only the real dynamic facts an announcement is built from — never pre-rendered
 * English prose, so every configured language can build its own natural sentence from the same data.
 */
export type AnnouncementType =
  | "EMERGENCY"
  | "TRAIN_APPROACHING"
  | "TRAIN_ARRIVING"
  | "TRAIN_AT_PLATFORM"
  | "DOORS_OPENING"
  | "BOARDING"
  | "DOORS_CLOSING"
  | "TRAIN_DEPARTING"
  | "NEXT_STATION"
  | "TRANSFER"
  | "DELAY"
  | "SERVICE_DISRUPTION"
  | "SAFETY";

/**
 * How insistently an announcement competes for PA airtime, highest first — see
 * `AnnouncementQueue`, which always plays the highest-priority waiting job next, lets `EMERGENCY`
 * cut off whatever is mid-sentence, and only ever drops the lower tiers under backlog.
 */
export type AnnouncementPriority =
  | "EMERGENCY"
  | "SAFETY"
  | "SERVICE_DISRUPTION"
  | "TRAIN_APPROACHING"
  | "TRAIN_ARRIVING"
  | "TRAIN_DEPARTING"
  | "NEXT_STATION"
  | "GENERAL_INFORMATION";

/** Lower is more urgent. */
export const PRIORITY_RANK: Readonly<Record<AnnouncementPriority, number>> = {
  EMERGENCY: 0,
  SAFETY: 1,
  SERVICE_DISRUPTION: 2,
  TRAIN_APPROACHING: 3,
  TRAIN_ARRIVING: 4,
  TRAIN_DEPARTING: 5,
  NEXT_STATION: 6,
  GENERAL_INFORMATION: 7,
};

/** Fixed per `AnnouncementType` — not a per-event choice — so priority stays predictable and can't
 * drift between two announcements of the same kind. */
export const ANNOUNCEMENT_PRIORITY: Readonly<Record<AnnouncementType, AnnouncementPriority>> = {
  EMERGENCY: "EMERGENCY",
  SAFETY: "SAFETY",
  SERVICE_DISRUPTION: "SERVICE_DISRUPTION",
  DELAY: "SERVICE_DISRUPTION",
  TRAIN_APPROACHING: "TRAIN_APPROACHING",
  TRAIN_ARRIVING: "TRAIN_ARRIVING",
  TRAIN_AT_PLATFORM: "TRAIN_ARRIVING",
  DOORS_OPENING: "TRAIN_ARRIVING",
  BOARDING: "TRAIN_ARRIVING",
  DOORS_CLOSING: "TRAIN_DEPARTING",
  TRAIN_DEPARTING: "TRAIN_DEPARTING",
  NEXT_STATION: "NEXT_STATION",
  TRANSFER: "GENERAL_INFORMATION",
};

/** Event types that only ever sound a chime (see `StationScene`) and never get a voice — a real
 * platform doesn't narrate every phase edge, and speaking all of them back to back is exactly what
 * makes a PA sound robotic. They still flow through detection so the chime is event-driven too. */
export const CHIME_ONLY_TYPES: ReadonlySet<AnnouncementType> = new Set([
  "TRAIN_ARRIVING",
  "TRAIN_AT_PLATFORM",
  "DOORS_OPENING",
  "DOORS_CLOSING",
]);

/** The three languages this station PA can speak. Kept separate from `LanguageMode` (a *set* of
 * these, in playback order) because a single announcement's text is always built one language at a
 * time — see `lib/announcements/templates`. */
export type LanguageCode = "en" | "hi" | "kn";

export const LANGUAGE_LABELS: Readonly<Record<LanguageCode, string>> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
};

/** The ordered set of languages an announcement plays in — always played one after another with a
 * natural pause between them, never overlapped (see `AnnouncementQueue`). Exactly the seven
 * combinations the spec calls out; `LANGUAGE_MODE_PRESETS` below is the authoritative list of which
 * combinations exist, this type is just "some non-empty ordered subset of the three languages." */
export type LanguageMode = readonly LanguageCode[];

export interface LanguageModePreset {
  readonly id: string;
  readonly label: string;
  readonly languages: LanguageMode;
}

export const LANGUAGE_MODE_PRESETS: readonly LanguageModePreset[] = [
  { id: "en", label: "English", languages: ["en"] },
  { id: "hi", label: "Hindi", languages: ["hi"] },
  { id: "kn", label: "Kannada", languages: ["kn"] },
  { id: "en-hi", label: "English + Hindi", languages: ["en", "hi"] },
  { id: "en-kn", label: "English + Kannada", languages: ["en", "kn"] },
  { id: "hi-kn", label: "Hindi + Kannada", languages: ["hi", "kn"] },
  { id: "en-hi-kn", label: "English + Hindi + Kannada", languages: ["en", "hi", "kn"] },
];

export const DEFAULT_LANGUAGE_MODE: LanguageMode = ["en"];

/** Real, dynamic fields an announcement's message is built from, in every configured language —
 * every value here comes from the same `SimulationState`/network data the rest of the 3D scene
 * reads (see `StationLayout3D`, `TrainVisual3D`). Station/destination/next-station carry both a real
 * network `code` (used to look up the correct spoken pronunciation per language, see
 * `config/stations/stationPronunciation.ts`) and a `name` (the accurate display form, used verbatim
 * for English/captions and as a last-resort fallback for speech). Fields are `null` only when
 * genuinely not applicable (e.g. a terminating train has no next station; a non-interchange station
 * has no transfer lines). */
export interface AnnouncementData {
  readonly stationCode: string;
  readonly stationName: string;
  readonly platform: number | null;
  readonly lineCode: string;
  readonly lineName: string;
  readonly destinationStationCode: string | null;
  readonly destinationStationName: string;
  readonly nextStationCode: string | null;
  readonly nextStationName: string | null;
  readonly trainNumber: string;
  readonly direction: TrainDirection;
  readonly delaySeconds: number;
  /** Other lines' display names reachable by interchange at this station — populated only for
   * `TRANSFER`. */
  readonly transferLines: readonly string[] | null;
  /** Plain-language description of an active disruption or realtime alert — populated only for
   * `SERVICE_DISRUPTION`/`EMERGENCY`. Always English free text (an operator's
   * `CreateDisruptionRequest.description`, or a feed alert's header), so it is only ever spoken in
   * the English pass; see `disruptionType` for what Hindi/Kannada speak instead. */
  readonly disruptionDescription: string | null;
  /** The disruption's fixed type — populated only for `SERVICE_DISRUPTION`. Every language builds
   * its own natural sentence from this (see `templates/*.ts`'s `disruptionTypeTemplates`) rather
   * than ever machine-translating `disruptionDescription`, which is real free text, not a station
   * name or other bounded vocabulary a curated pronunciation table can cover. */
  readonly disruptionType: DisruptionType | null;
}

export interface AnnouncementEvent {
  readonly id: string;
  readonly type: AnnouncementType;
  readonly priority: AnnouncementPriority;
  /** `null` for station-wide events not tied to any one train (`SERVICE_DISRUPTION`/`EMERGENCY`
   * raised from a disruption or realtime alert). */
  readonly trainId: number | null;
  readonly data: AnnouncementData;
}

export interface AudioSettings {
  readonly muted: boolean;
  /** 0..1 master volume, applied to every sound this feature plays. */
  readonly volume: number;
  readonly announcementsEnabled: boolean;
  readonly ambienceEnabled: boolean;
  /** Which language(s) announcements are spoken in, and in what order — configurable by the
   * operator, external to any component (see `hooks/useAudioSettings.ts`, `lib/audio/AudioManager.ts`). */
  readonly languageMode: LanguageMode;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  volume: 0.7,
  announcementsEnabled: true,
  ambienceEnabled: true,
  languageMode: DEFAULT_LANGUAGE_MODE,
};

/**
 * How an announcement actually reached the listener — shown next to the caption so a synthetic
 * voice is never mistaken for a real recording, and a silent failure is never mistaken for audio:
 *
 * - `RECORDED` — a real recording from `public/audio/announcements/manifest.json`, carrying its
 *   license and attribution (see `lib/audio/recordedClips.ts`).
 * - `SYNTHESIZED` — a cached, PA-processed cloud-TTS clip from the backend.
 * - `BROWSER_SPEECH` — the browser's own speech engine, the lowest-quality voice tier.
 * - `TEXT_ONLY` — no audio could be played; the caption is the whole announcement.
 */
export type AnnouncementDelivery = "RECORDED" | "SYNTHESIZED" | "BROWSER_SPEECH" | "TEXT_ONLY";

/** Provenance of a `RECORDED` clip, straight from its manifest entry. */
export interface RecordedClipProvenance {
  readonly attribution: string;
  readonly license: string;
  readonly sourceUrl: string | null;
  /** True only when the manifest entry documents BMRCL's own permission for it — see
   * `lib/audio/recordedClips.ts`. Nothing else may describe audio as official. */
  readonly official: boolean;
}
