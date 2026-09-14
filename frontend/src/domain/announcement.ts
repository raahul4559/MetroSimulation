import type { TrainDirection } from "./trainsim/trainState";

/**
 * A station-announcement trigger — always fired off a real transition or a real state fact in the
 * shared simulation state (a `TrainPhase3D` edge, an active `Disruption`, a delayed `TrainState`;
 * see `lib/station3d/announcementService.ts`), never on a timer or user action of its own.
 * `AnnouncementService`/`AudioManager` are the only consumers of the *text* this produces; this type
 * itself carries only the real dynamic facts an announcement is built from — never pre-rendered
 * English prose, so every configured language can build its own natural sentence from the same data.
 */
export type AnnouncementType =
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

/** How insistently an announcement competes for PA airtime — see `AnnouncementQueue`. `HIGH` events
 * are always spoken and always win ordering; `MEDIUM` events are spoken unless the queue already has
 * a backlog; `LOW` events never get a voice at all (the matching chime/rumble effect is the whole
 * announcement) so the platform doesn't drown in narration for every minor phase edge. */
export type AnnouncementPriority = "LOW" | "MEDIUM" | "HIGH";

/** Fixed per `AnnouncementType` — not a per-event choice — so priority stays predictable and can't
 * drift between two announcements of the same kind. */
export const ANNOUNCEMENT_PRIORITY: Readonly<Record<AnnouncementType, AnnouncementPriority>> = {
  TRAIN_APPROACHING: "HIGH",
  SAFETY: "HIGH",
  TRAIN_DEPARTING: "HIGH",
  DELAY: "HIGH",
  SERVICE_DISRUPTION: "HIGH",
  BOARDING: "MEDIUM",
  TRANSFER: "MEDIUM",
  NEXT_STATION: "MEDIUM",
  TRAIN_ARRIVING: "LOW",
  TRAIN_AT_PLATFORM: "LOW",
  DOORS_OPENING: "LOW",
  DOORS_CLOSING: "LOW",
};

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
  /** Plain-language description of an active disruption — populated only for `SERVICE_DISRUPTION`. */
  readonly disruptionDescription: string | null;
}

export interface AnnouncementEvent {
  readonly id: string;
  readonly type: AnnouncementType;
  readonly priority: AnnouncementPriority;
  /** `null` for station-wide events not tied to any one train (currently only `SERVICE_DISRUPTION`
   * for a station-level disruption). */
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
