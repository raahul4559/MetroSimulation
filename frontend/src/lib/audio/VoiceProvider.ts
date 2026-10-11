import type { AnnouncementDelivery, LanguageCode, RecordedClipProvenance } from "@/domain/announcement";
import { fetchAnnouncementAudio } from "@/lib/api/announcementAudio";
import { audioManager } from "./AudioManager";
import { findClip, loadRecordedClips } from "./recordedClips";

export interface SpeakOptions {
  readonly volume: number;
  readonly rate?: number;
}

/**
 * One utterance, resolved to the best voice tier available for it *before* anything plays — so
 * the caption can say how it's being delivered from its first frame. `play()` resolves when the
 * audio finishes (or is cancelled) and rejects if playback itself fails, which the queue turns
 * into a text-only caption. A `TEXT_ONLY` utterance's `play()` is a no-op.
 */
export interface PreparedUtterance {
  readonly delivery: AnnouncementDelivery;
  readonly provenance: RecordedClipProvenance | null;
  play(): Promise<void>;
}

/**
 * Abstraction over "turn this text into spoken audio in this language" — kept separate from
 * `AudioManager` (which owns chimes/rumble/ambience/settings) and entirely outside React/the 3D
 * scene. Tiers, best first: a licensed real recording (`recordedClips.ts`), a cached PA-processed
 * cloud-TTS clip from the backend, the browser's own speech engine, and finally text only.
 */
export interface VoiceProvider {
  prepare(text: string, language: LanguageCode, opts: SpeakOptions): Promise<PreparedUtterance>;
  /** Warms whatever cache {@link prepare} will read, without playing anything — called the moment
   * an event is queued, so the fetch overlaps whatever is speaking before it. */
  prefetch(text: string, language: LanguageCode): void;
  /** Stops whatever is currently speaking. Does not touch `AnnouncementQueue`'s own queue. */
  cancelAll(): void;
}

const TEXT_ONLY: PreparedUtterance = { delivery: "TEXT_ONLY", provenance: null, play: () => Promise.resolve() };

/** Preferred voice `lang` tags, most-specific first, for a natural Indian-accented reading of each
 * language — checked as exact matches, then as prefixes (some engines report `hi-IN-x` variants). */
const PREFERRED_LANG_TAGS: Readonly<Record<LanguageCode, readonly string[]>> = {
  // Any English voice reads English intelligibly; Hindi/Kannada text through a voice for another
  // language is gibberish, so those have no such fallback (they go text-only instead).
  en: ["en-in", "en"],
  hi: ["hi-in", "hi"],
  kn: ["kn-in", "kn"],
};

/** Named Indian-accented voices several browsers/OSes ship (Edge/Windows, Chrome/Android) — checked
 * by substring against the voice's reported name when a `lang`-tag match isn't available. Kannada
 * has essentially no dedicated desktop-browser voices as of writing; a `kn-IN` `lang` match (mobile
 * Chrome, some Android WebViews) is the realistic path there, this list is a bonus, not the primary
 * mechanism. */
const NAME_HINTS: Readonly<Record<LanguageCode, readonly string[]>> = {
  en: ["india", "ravi", "heera", "neerja", "indian"],
  hi: ["hindi", "swara", "madhur"],
  kn: ["kannada"],
};

const VOICE_LOAD_TIMEOUT_MS = 1000;

/**
 * `VoiceProvider` over `window.speechSynthesis`. Picks one voice per language on first use and
 * reuses it for every subsequent announcement in that language — a consistent voice identity,
 * never re-picked at random between calls. If the platform has no voice for a language (Kannada on
 * most desktops), the utterance is `TEXT_ONLY` rather than read out by a voice for another language.
 */
class WebSpeechVoiceProvider implements VoiceProvider {
  private voicesReadyPromise: Promise<void> | null = null;
  private readonly chosenVoice = new Map<LanguageCode, SpeechSynthesisVoice | null>();

  async prepare(text: string, language: LanguageCode, opts: SpeakOptions): Promise<PreparedUtterance> {
    if (!text || !hasSpeechSynthesis()) return TEXT_ONLY;
    await this.ensureVoicesReady();
    const voice = this.resolveVoice(language);
    if (!voice) return TEXT_ONLY;

    return {
      delivery: "BROWSER_SPEECH",
      provenance: null,
      play: () =>
        new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = voice;
          utterance.lang = voice.lang;
          // Calm, moderate-paced professional PA delivery — slightly below 1x.
          utterance.rate = opts.rate ?? 0.93;
          utterance.pitch = 1;
          utterance.volume = Math.min(1, Math.max(0, opts.volume));
          utterance.onend = () => resolve();
          utterance.onerror = (e) => {
            // Our own cancelAll() surfaces as an error too; that's a stop, not a failure.
            if (e.error === "canceled" || e.error === "interrupted") resolve();
            else reject(new Error(`speechSynthesis: ${e.error}`));
          };
          window.speechSynthesis.speak(utterance);
        }),
    };
  }

  prefetch(): void {
    // Nothing to warm — the browser speaks locally.
  }

  cancelAll(): void {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
  }

  private ensureVoicesReady(): Promise<void> {
    if (!hasSpeechSynthesis()) return Promise.resolve();
    if (this.voicesReadyPromise) return this.voicesReadyPromise;

    this.voicesReadyPromise = new Promise<void>((resolve) => {
      if (window.speechSynthesis.getVoices().length > 0) {
        resolve();
        return;
      }
      const onVoicesChanged = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
      // Some browsers populate voices synchronously and never fire `voiceschanged` at all — don't
      // block the first announcement on an event that may never come.
      window.setTimeout(resolve, VOICE_LOAD_TIMEOUT_MS);
    });
    return this.voicesReadyPromise;
  }

  private resolveVoice(language: LanguageCode): SpeechSynthesisVoice | null {
    if (this.chosenVoice.has(language)) return this.chosenVoice.get(language) ?? null;

    const voices = window.speechSynthesis.getVoices();
    // An empty list may just mean voices haven't loaded yet — don't cache "none" from that.
    if (voices.length === 0) return null;
    const voice = findByLangTag(voices, PREFERRED_LANG_TAGS[language]) ?? findByNameHint(voices, NAME_HINTS[language]);
    this.chosenVoice.set(language, voice);
    return voice;
  }
}

function findByLangTag(voices: readonly SpeechSynthesisVoice[], tags: readonly string[]): SpeechSynthesisVoice | null {
  for (const tag of tags) {
    const exact = voices.find((v) => v.lang.toLowerCase() === tag);
    if (exact) return exact;
  }
  for (const tag of tags) {
    const prefixed = voices.find((v) => v.lang.toLowerCase().startsWith(tag));
    if (prefixed) return prefixed;
  }
  return null;
}

function findByNameHint(voices: readonly SpeechSynthesisVoice[], hints: readonly string[]): SpeechSynthesisVoice | null {
  return voices.find((v) => hints.some((hint) => v.name.toLowerCase().includes(hint))) ?? null;
}

function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const CACHE_NAME = "announcement-audio-v1";
/** Decoded clips kept in memory — enough for every fixed phrase plus the current station's
 * dynamic ones in all three languages, without holding a whole session's worth of PCM. */
const DECODED_CACHE_LIMIT = 96;

/**
 * The PA voice: plays real recordings or pre-synthesized, PA-processed clips through
 * `AudioManager`'s announcement chain, and falls back to {@link WebSpeechVoiceProvider} only when
 * neither exists for this sentence (or there's no `AudioContext` yet to play them through).
 *
 * Nothing is synthesized twice: the backend keeps every clip on disk, the browser's Cache Storage
 * (`{@value CACHE_NAME}`) mirrors each one it fetched, decoded buffers are kept in memory, and a
 * sentence the backend couldn't synthesize (`204`) isn't asked for again this session.
 */
class CachedAudioVoiceProvider implements VoiceProvider {
  private readonly fallback = new WebSpeechVoiceProvider();
  private currentSource: AudioBufferSourceNode | null = null;
  private cachePromise: Promise<Cache | null> | null = null;
  private readonly decoded = new Map<string, AudioBuffer>();
  private readonly inFlight = new Map<string, Promise<ArrayBuffer | null>>();
  private readonly unavailable = new Set<string>();

  async prepare(text: string, language: LanguageCode, opts: SpeakOptions): Promise<PreparedUtterance> {
    if (!text) return TEXT_ONLY;

    const ctx = audioManager.getContext();
    const destination = audioManager.getAnnouncementDestination();
    if (ctx && destination) {
      const clip = findClip(await loadRecordedClips(), text, language);
      if (clip) {
        const buffer = await this.decode(ctx, `rec|${clip.url}`, () => fetchBytes(clip.url));
        if (buffer) return this.prepared(ctx, destination, buffer, "RECORDED", clip.provenance);
      }

      const buffer = await this.decode(ctx, `tts|${language}|${text}`, () => this.loadSynthesized(text, language));
      if (buffer) return this.prepared(ctx, destination, buffer, "SYNTHESIZED", null);
    }

    return this.fallback.prepare(text, language, opts);
  }

  prefetch(text: string, language: LanguageCode): void {
    if (!text) return;
    void loadRecordedClips().then((index) => {
      if (!findClip(index, text, language)) void this.loadSynthesized(text, language);
    });
  }

  cancelAll(): void {
    try {
      this.currentSource?.stop();
    } catch {
      // Already stopped.
    }
    this.currentSource = null;
    this.fallback.cancelAll();
  }

  private prepared(
    ctx: AudioContext,
    destination: AudioNode,
    buffer: AudioBuffer,
    delivery: AnnouncementDelivery,
    provenance: RecordedClipProvenance | null
  ): PreparedUtterance {
    return {
      delivery,
      provenance,
      play: () =>
        new Promise<void>((resolve, reject) => {
          try {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(destination);
            source.onended = () => {
              if (this.currentSource === source) this.currentSource = null;
              resolve();
            };
            this.currentSource = source;
            source.start();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        }),
    };
  }

  private async decode(
    ctx: AudioContext,
    key: string,
    load: () => Promise<ArrayBuffer | null>
  ): Promise<AudioBuffer | null> {
    const hit = this.decoded.get(key);
    if (hit) {
      // Re-insert so the map's insertion order doubles as least-recently-used order.
      this.decoded.delete(key);
      this.decoded.set(key, hit);
      return hit;
    }
    const bytes = await load();
    if (!bytes) return null;
    try {
      // `decodeAudioData` detaches its input in most engines — decode a copy.
      const buffer = await ctx.decodeAudioData(bytes.slice(0));
      this.decoded.set(key, buffer);
      if (this.decoded.size > DECODED_CACHE_LIMIT) {
        const oldest = this.decoded.keys().next().value;
        if (oldest !== undefined) this.decoded.delete(oldest);
      }
      return buffer;
    } catch {
      return null;
    }
  }

  /** The clip's bytes from Cache Storage, or from the backend once. Concurrent requests for the
   * same sentence (a prefetch racing the real prepare) share one fetch. */
  private loadSynthesized(text: string, language: LanguageCode): Promise<ArrayBuffer | null> {
    const key = `${language}|${text}`;
    if (this.unavailable.has(key)) return Promise.resolve(null);
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const cache = await this.openCache();
      const request = cacheRequestFor(text, language);
      if (cache) {
        const cached = await cache.match(request);
        if (cached) return cached.arrayBuffer();
      }
      const fetched = await fetchAnnouncementAudio(text, language);
      if (!fetched) {
        this.unavailable.add(key);
        return null;
      }
      if (cache) {
        // Best-effort; a quota error here shouldn't block playing the clip we already have.
        void cache.put(request, new Response(fetched.slice(0), { headers: { "Content-Type": "audio/mpeg" } })).catch(() => {});
      }
      return fetched;
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, promise);
    return promise;
  }

  private openCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return Promise.resolve(null);
    if (!this.cachePromise) {
      this.cachePromise = caches.open(CACHE_NAME).catch(() => null);
    }
    return this.cachePromise;
  }
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function cacheRequestFor(text: string, language: LanguageCode): Request {
  // Not a real endpoint — just a stable, content-addressed key for Cache Storage, which keys on
  // Request rather than an arbitrary string.
  return new Request(`https://announcement-audio.metrosim.local/${language}/${encodeURIComponent(text)}`);
}

export const voiceProvider: VoiceProvider = new CachedAudioVoiceProvider();
