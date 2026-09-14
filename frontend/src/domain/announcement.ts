/**
 * A station-announcement trigger — always fired off a real transition in the shared simulation
 * state (a `TrainPhase3D` edge, resolved by `lib/station3d/announcementService.ts`), never on a
 * timer or user action of its own. `AudioManager`/the caption overlay are the only consumers; this
 * type carries no audio itself.
 */
export type AnnouncementType =
  | "TRAIN_APPROACHING"
  | "TRAIN_ARRIVING"
  | "TRAIN_AT_PLATFORM"
  | "DOORS_OPENING"
  | "BOARDING"
  | "DOORS_CLOSING"
  | "TRAIN_DEPARTING"
  | "NEXT_STATION";

/** Real, dynamic fields an announcement's message is built from — every value here comes from the
 * same `SimulationState`/network data the rest of the 3D scene reads (see `StationLayout3D`,
 * `TrainVisual3D`). `platform`/`nextStation` are `null` only when genuinely not applicable (e.g. a
 * terminating train has no next station). */
export interface AnnouncementEvent {
  readonly id: string;
  readonly type: AnnouncementType;
  readonly trainId: number;
  readonly trainCode: string;
  readonly station: string;
  readonly platform: number | null;
  readonly line: string;
  readonly destination: string;
  readonly nextStation: string | null;
  readonly message: string;
}

export interface AudioSettings {
  readonly muted: boolean;
  /** 0..1 master volume, applied to every sound this feature plays. */
  readonly volume: number;
  readonly announcementsEnabled: boolean;
  readonly ambienceEnabled: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  volume: 0.7,
  announcementsEnabled: true,
  ambienceEnabled: true,
};
