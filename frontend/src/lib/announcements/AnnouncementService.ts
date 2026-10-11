import { CHIME_ONLY_TYPES, type AnnouncementEvent } from "@/domain/announcement";
import { audioManager } from "@/lib/audio/AudioManager";
import { voiceProvider } from "@/lib/audio/VoiceProvider";
import { buildAnnouncementText } from "./templates";
import { AnnouncementQueue, type QueueCaption } from "./AnnouncementQueue";

/** What the PA is saying right now, in which language, and how it's being delivered. */
export type AnnouncementCaption = QueueCaption;

/**
 * The orchestrator the spec's architecture diagram calls `AnnouncementService`: takes a real
 * `AnnouncementEvent` (see `lib/station3d/announcementService.ts`, which derives these from actual
 * `TrainPhase3D`/disruption/delay transitions — never invented here), resolves the operator's
 * configured `languageMode` and per-language text (`templates/`), and hands each language's
 * utterance to `VoiceProvider` through an `AnnouncementQueue` so multiple languages/events never
 * overlap and the most urgent one always goes first. A module-level singleton, like `AudioManager` — the 3D scene only ever calls
 * {@link announce}, it never touches templates, the queue, or `VoiceProvider` directly.
 */
class AnnouncementServiceImpl {
  private readonly listeners = new Set<(caption: AnnouncementCaption | null) => void>();
  private readonly queue: AnnouncementQueue;

  constructor() {
    this.queue = new AnnouncementQueue({
      prepare: (text, language) => voiceProvider.prepare(text, language, { volume: audioManager.getSettings().volume }),
      textFor: (event, language) => buildAnnouncementText(event.type, event.data, language),
      onCaption: (state) => {
        for (const listener of this.listeners) listener(state);
      },
      isEnabled: () => {
        const settings = audioManager.getSettings();
        return !settings.muted && settings.announcementsEnabled;
      },
      interrupt: () => voiceProvider.cancelAll(),
    });

    // A mid-announcement mute/disable should cut the PA immediately, not let whatever's already
    // queued keep talking until it drains naturally.
    audioManager.subscribe((settings) => {
      if (settings.muted || !settings.announcementsEnabled) this.stopAll();
    });
  }

  /** Queues `event` to be spoken in the operator's currently-configured language(s), in order, with
   * natural pauses between them — a no-op if audio is muted or announcements are turned off, and
   * for `CHIME_ONLY_TYPES`, whose chime (played by the scene) is the whole announcement. Each
   * language's audio starts loading immediately, so it's usually ready by the time its turn comes. */
  announce(event: AnnouncementEvent): void {
    const settings = audioManager.getSettings();
    if (settings.muted || !settings.announcementsEnabled || CHIME_ONLY_TYPES.has(event.type)) return;
    for (const language of settings.languageMode) {
      voiceProvider.prefetch(buildAnnouncementText(event.type, event.data, language), language);
    }
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
