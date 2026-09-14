import type { AnnouncementEvent, LanguageCode } from "@/domain/announcement";
import { audioManager } from "@/lib/audio/AudioManager";
import { voiceProvider } from "@/lib/audio/VoiceProvider";
import { buildAnnouncementText } from "./templates";
import { AnnouncementQueue } from "./AnnouncementQueue";

export interface AnnouncementCaption {
  readonly text: string;
  readonly language: LanguageCode;
  readonly event: AnnouncementEvent;
}

/**
 * The orchestrator the spec's architecture diagram calls `AnnouncementService`: takes a real
 * `AnnouncementEvent` (see `lib/station3d/announcementService.ts`, which derives these from actual
 * `TrainPhase3D`/disruption/delay transitions — never invented here), resolves the operator's
 * configured `languageMode` and per-language text (`templates/`), and hands each language's
 * utterance to `VoiceProvider` through an `AnnouncementQueue` so multiple languages/events never
 * overlap. A module-level singleton, like `AudioManager` — the 3D scene only ever calls
 * {@link announce}, it never touches templates, the queue, or `VoiceProvider` directly.
 */
class AnnouncementServiceImpl {
  private readonly listeners = new Set<(caption: AnnouncementCaption | null) => void>();
  private readonly queue: AnnouncementQueue;

  constructor() {
    this.queue = new AnnouncementQueue(
      (text, language) => voiceProvider.speak(text, language, { volume: audioManager.getSettings().volume }),
      (event, language) => buildAnnouncementText(event.type, event.data, language),
      (state) => {
        for (const listener of this.listeners) listener(state);
      },
      () => {
        const settings = audioManager.getSettings();
        return !settings.muted && settings.announcementsEnabled;
      }
    );

    // A mid-announcement mute/disable should cut the PA immediately, not let whatever's already
    // queued keep talking until it drains naturally.
    audioManager.subscribe((settings) => {
      if (settings.muted || !settings.announcementsEnabled) this.stopAll();
    });
  }

  /** Queues `event` to be spoken in the operator's currently-configured language(s), in order, with
   * natural pauses between them — a no-op if audio is muted or announcements are turned off. Never
   * called for `LOW`-priority events by design (see `ANNOUNCEMENT_PRIORITY`); the matching
   * chime/rumble sound effect *is* the whole announcement for those. */
  announce(event: AnnouncementEvent): void {
    const settings = audioManager.getSettings();
    if (settings.muted || !settings.announcementsEnabled) return;
    this.queue.enqueue(event, settings.languageMode);
  }

  /** Subscribes to what's audibly being spoken right now — `null` when nothing is. Drives the
   * on-screen caption, which as a result always matches the language actually playing rather than a
   * fixed English string regardless of `languageMode`. */
  subscribeCaption(listener: (caption: AnnouncementCaption | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Clears anything queued and cancels in-flight speech — called on mute/disable and when the
   * operator leaves the station (see `StationScene`'s unmount effect). */
  stopAll(): void {
    this.queue.clear();
    voiceProvider.cancelAll();
  }
}

export const announcementService = new AnnouncementServiceImpl();
