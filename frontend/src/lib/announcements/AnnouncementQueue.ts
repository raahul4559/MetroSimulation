import type { AnnouncementEvent, AnnouncementPriority, LanguageCode, LanguageMode } from "@/domain/announcement";

const INTER_LANGUAGE_PAUSE_MS = 450;
const INTER_EVENT_PAUSE_MS = 350;

/** How many jobs may sit waiting (not counting whichever one is currently playing) before a new
 * `MEDIUM` arrival gets dropped rather than piling up — the "sensible priority and timing rules"
 * that keep the platform from turning into a wall of narration when several trains transition at
 * once. `HIGH` events are never dropped for backlog; `MEDIUM_BACKLOG_LIMIT` only ever throttles
 * `MEDIUM`. */
const MEDIUM_BACKLOG_LIMIT = 2;
/** Absolute cap regardless of priority — a defensive ceiling, not a normal operating limit. */
const MAX_QUEUE_LENGTH = 6;

interface QueueJob {
  readonly event: AnnouncementEvent;
  readonly languages: LanguageMode;
}

export type SpeakFn = (text: string, language: LanguageCode, event: AnnouncementEvent) => Promise<void>;
export type CaptionFn = (state: { text: string; language: LanguageCode; event: AnnouncementEvent } | null) => void;
export type TextForFn = (event: AnnouncementEvent, language: LanguageCode) => string;

/**
 * Sequences spoken announcements: one event at a time, one language at a time within that event,
 * always waiting for the previous utterance to actually finish before starting the next — so two
 * languages (or two different events) can never overlap, per spec. Holds no audio logic itself
 * (`speak` is injected, see `AnnouncementService`); this is purely ordering, priority, and pacing.
 */
export class AnnouncementQueue {
  private readonly jobs: QueueJob[] = [];
  private draining = false;
  private currentEvent: AnnouncementEvent | null = null;

  constructor(
    private readonly speak: SpeakFn,
    private readonly textFor: TextForFn,
    private readonly onCaption: CaptionFn,
    private readonly isEnabled: () => boolean
  ) {}

  /** Queues `event` to be spoken in each of `languages`, in order. Silently declines `LOW`-priority
   * events (chime-only by design, see `ANNOUNCEMENT_PRIORITY`) and throttles `MEDIUM` events once a
   * backlog has built up; `HIGH` events are always accepted. */
  enqueue(event: AnnouncementEvent, languages: LanguageMode): void {
    if (event.priority === "LOW" || languages.length === 0) return;
    if (!this.admits(event.priority)) return;

    this.jobs.push({ event, languages });
    if (this.jobs.length > MAX_QUEUE_LENGTH) this.jobs.shift();
    void this.drain();
  }

  /** Drops everything waiting and stops whatever caption is showing — does not stop audio already
   * in flight at the `VoiceProvider` level, callers handle that themselves (see
   * `AnnouncementService.setEnabled`). */
  clear(): void {
    this.jobs.length = 0;
    this.onCaption(null);
  }

  private admits(priority: AnnouncementPriority): boolean {
    if (priority === "HIGH") return true;
    const pending = this.jobs.length; // excludes whichever job is currently playing, it's already shifted off
    return pending < MEDIUM_BACKLOG_LIMIT;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift();
        if (!job) break;
        if (!this.isEnabled()) continue;
        this.currentEvent = job.event;
        await this.playJob(job);
        this.currentEvent = null;
        if (this.jobs.length > 0) await delay(INTER_EVENT_PAUSE_MS);
      }
    } finally {
      this.draining = false;
      this.currentEvent = null;
      this.onCaption(null);
    }
  }

  private async playJob(job: QueueJob): Promise<void> {
    for (let i = 0; i < job.languages.length; i++) {
      if (!this.isEnabled()) return;
      const language = job.languages[i];
      const text = this.textFor(job.event, language);
      if (!text) continue;
      this.onCaption({ text, language, event: job.event });
      await this.speak(text, language, job.event);
      if (i < job.languages.length - 1) await delay(INTER_LANGUAGE_PAUSE_MS);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
