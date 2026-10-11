import {
  CHIME_ONLY_TYPES,
  PRIORITY_RANK,
  type AnnouncementDelivery,
  type AnnouncementEvent,
  type AnnouncementPriority,
  type AnnouncementType,
  type LanguageCode,
  type LanguageMode,
  type RecordedClipProvenance,
} from "@/domain/announcement";
import type { PreparedUtterance } from "@/lib/audio/VoiceProvider";

const INTER_LANGUAGE_PAUSE_MS = 450;
const INTER_EVENT_PAUSE_MS = 350;

/** Once this many jobs are waiting, `NEXT_STATION`/`GENERAL_INFORMATION` arrivals are dropped
 * rather than piling up behind train announcements that matter more. */
const LOW_TIER_BACKLOG_LIMIT = 2;
/** Absolute cap; past it the least urgent waiting job is evicted. */
const MAX_QUEUE_LENGTH = 8;
/** The same sentence isn't repeated within this window — two trains departing a few seconds apart
 * get one "please stand clear of the doors", the way a real PA operator would say it. */
const REPEAT_COOLDOWN_MS = 15_000;

/** How long a job may wait before it's no longer true enough to say. A train announcement that
 * sat behind others for 20s describes a train that has moved on — at high simulation speed most of
 * the backlog goes stale this way, which is the point. Safety/disruption messages stay valid. */
const MAX_WAIT_MS: Readonly<Record<AnnouncementPriority, number>> = {
  EMERGENCY: 120_000,
  SAFETY: 60_000,
  SERVICE_DISRUPTION: 60_000,
  TRAIN_APPROACHING: 20_000,
  TRAIN_ARRIVING: 20_000,
  TRAIN_DEPARTING: 20_000,
  NEXT_STATION: 12_000,
  GENERAL_INFORMATION: 12_000,
};

/** Where an event sits in one train's stop at this station. A newer stage makes any earlier,
 * still-unspoken announcement for the same train obsolete ("arriving" after it has left). */
const TRAIN_STAGE: Partial<Readonly<Record<AnnouncementType, number>>> = {
  TRAIN_APPROACHING: 0,
  TRAIN_ARRIVING: 1,
  TRAIN_AT_PLATFORM: 1,
  DOORS_OPENING: 2,
  BOARDING: 2,
  DELAY: 2,
  TRANSFER: 2,
  SAFETY: 3,
  DOORS_CLOSING: 3,
  TRAIN_DEPARTING: 3,
  NEXT_STATION: 4,
};

/** Reading time for a text-only caption: long enough to read, short enough not to stall the PA. */
const TEXT_ONLY_MS_PER_CHAR = 55;
const TEXT_ONLY_MIN_MS = 2_500;
const TEXT_ONLY_MAX_MS = 9_000;

interface QueueJob {
  readonly event: AnnouncementEvent;
  readonly languages: LanguageMode;
  /** The sentence in the first language — what "the same announcement" means for dedupe. */
  readonly text: string;
  readonly enqueuedAt: number;
  readonly seq: number;
}

export interface QueueCaption {
  readonly text: string;
  readonly language: LanguageCode;
  readonly event: AnnouncementEvent;
  readonly delivery: AnnouncementDelivery;
  readonly provenance: RecordedClipProvenance | null;
}

export interface AnnouncementQueueDeps {
  readonly prepare: (text: string, language: LanguageCode, event: AnnouncementEvent) => Promise<PreparedUtterance>;
  readonly textFor: (event: AnnouncementEvent, language: LanguageCode) => string;
  readonly onCaption: (caption: QueueCaption | null) => void;
  readonly isEnabled: () => boolean;
  /** Stops audio that is currently playing — used when an `EMERGENCY` preempts it. */
  readonly interrupt: () => void;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Sequences spoken announcements: one event at a time, one language at a time within that event,
 * always waiting for the previous utterance to finish — so two languages or two events never
 * overlap. Holds no audio logic itself (`prepare` is injected, see `AnnouncementService`); this is
 * purely ordering, priority, pacing and the text-only fallback.
 *
 * Ordering is strictly by {@link PRIORITY_RANK}, FIFO within a tier. `EMERGENCY` also cuts off
 * whatever lower-priority announcement is mid-sentence. If an utterance can't be played at all,
 * its caption is held on screen for a reading interval instead, so the announcement still happens.
 */
export class AnnouncementQueue {
  private readonly jobs: QueueJob[] = [];
  private current: QueueJob | null = null;
  private draining = false;
  private seq = 0;
  /** Bumped whenever whatever is playing must stop early (preemption or clear). */
  private generation = 0;
  private wakeHold: (() => void) | null = null;
  private readonly lastSpokenAt = new Map<string, number>();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: AnnouncementQueueDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms)));
  }

  /** Waiting jobs, most urgent first (excludes whatever is playing). For tests/diagnostics. */
  pending(): readonly AnnouncementEvent[] {
    return this.jobs.map((j) => j.event);
  }

  enqueue(event: AnnouncementEvent, languages: LanguageMode): void {
    if (CHIME_ONLY_TYPES.has(event.type) || languages.length === 0) return;

    const text = this.deps.textFor(event, languages[0]!);
    if (this.current?.text === text || this.jobs.some((j) => j.text === text)) return;
    const spokenAt = this.lastSpokenAt.get(text);
    if (spokenAt != null && this.now() - spokenAt < REPEAT_COOLDOWN_MS) return;

    this.dropSupersededBy(event);

    const rank = PRIORITY_RANK[event.priority];
    if (rank >= PRIORITY_RANK.NEXT_STATION && this.jobs.length >= LOW_TIER_BACKLOG_LIMIT) return;

    const job: QueueJob = { event, languages, text, enqueuedAt: this.now(), seq: ++this.seq };
    const at = this.jobs.findIndex((j) => PRIORITY_RANK[j.event.priority] > rank);
    if (at === -1) this.jobs.push(job);
    else this.jobs.splice(at, 0, job);
    if (this.jobs.length > MAX_QUEUE_LENGTH) this.jobs.pop();

    if (event.priority === "EMERGENCY" && this.current && this.current.event.priority !== "EMERGENCY") {
      this.stopCurrent();
    }
    void this.drain();
  }

  /** Drops everything waiting and stops whatever is playing or holding a text caption. */
  clear(): void {
    this.jobs.length = 0;
    this.stopCurrent();
    this.deps.onCaption(null);
  }

  private stopCurrent(): void {
    this.generation += 1;
    this.deps.interrupt();
    this.wakeHold?.();
  }

  private dropSupersededBy(event: AnnouncementEvent): void {
    const stage = TRAIN_STAGE[event.type];
    if (event.trainId == null || stage == null) return;
    for (let i = this.jobs.length - 1; i >= 0; i--) {
      const queued = this.jobs[i]!.event;
      const queuedStage = TRAIN_STAGE[queued.type];
      if (queued.trainId === event.trainId && queuedStage != null && queuedStage < stage) this.jobs.splice(i, 1);
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.jobs.length > 0) {
        const job = this.jobs.shift()!;
        if (!this.deps.isEnabled()) continue;
        if (this.now() - job.enqueuedAt > MAX_WAIT_MS[job.event.priority]) continue;
        this.current = job;
        this.rememberSpoken(job.text);
        await this.playJob(job, this.generation);
        this.current = null;
        if (this.jobs.length > 0) await this.sleep(INTER_EVENT_PAUSE_MS);
      }
    } finally {
      this.current = null;
      this.draining = false;
      this.deps.onCaption(null);
    }
  }

  private async playJob(job: QueueJob, generation: number): Promise<void> {
    const stopped = () => generation !== this.generation || !this.deps.isEnabled();
    const { languages } = job;
    for (let i = 0; i < languages.length; i++) {
      if (stopped()) return;
      const language = languages[i]!;
      const text = this.deps.textFor(job.event, language);
      if (!text) continue;

      let utterance: PreparedUtterance;
      try {
        utterance = await this.deps.prepare(text, language, job.event);
      } catch {
        utterance = { delivery: "TEXT_ONLY", provenance: null, play: () => Promise.resolve() };
      }
      if (stopped()) return;

      const caption = { text, language, event: job.event, provenance: utterance.provenance };
      this.deps.onCaption({ ...caption, delivery: utterance.delivery });
      if (utterance.delivery === "TEXT_ONLY") {
        await this.hold(readingTimeMs(text));
      } else {
        try {
          await utterance.play();
        } catch {
          if (stopped()) return;
          this.deps.onCaption({ ...caption, delivery: "TEXT_ONLY", provenance: null });
          await this.hold(readingTimeMs(text));
        }
      }
      if (i < languages.length - 1 && !stopped()) await this.sleep(INTER_LANGUAGE_PAUSE_MS);
    }
  }

  private rememberSpoken(text: string): void {
    const now = this.now();
    this.lastSpokenAt.set(text, now);
    for (const [t, at] of this.lastSpokenAt) {
      if (now - at >= REPEAT_COOLDOWN_MS) this.lastSpokenAt.delete(t);
    }
  }

  /** A pause that {@link stopCurrent} can cut short. */
  private hold(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (this.wakeHold === finish) this.wakeHold = null;
        resolve();
      };
      this.wakeHold = finish;
      void this.sleep(ms).then(finish);
    });
  }
}

export function readingTimeMs(text: string): number {
  return Math.min(TEXT_ONLY_MAX_MS, Math.max(TEXT_ONLY_MIN_MS, text.length * TEXT_ONLY_MS_PER_CHAR));
}
