import type { LanguageCode } from "@/domain/announcement";
import { fetchAnnouncementAudio } from "@/lib/api/announcementAudio";
import { audioManager } from "./AudioManager";

export interface SpeakOptions {
  readonly volume: number;
  readonly rate?: number;
}

/**
 * Abstraction over "turn this text into spoken audio in this language" — kept separate from
 * `AudioManager` (which owns chimes/rumble/ambience/settings) and entirely outside React/the 3D
 * scene, exactly so the underlying engine can be swapped later (a hosted Indian-language TTS API,
 * say) without touching `AnnouncementQueue` or any component. `WebSpeechVoiceProvider` below is the
 * only implementation today, using the browser's own Speech Synthesis API — there is no bundled or
 * licensed Namma Metro voice audio in this repo.
 */
export interface VoiceProvider {
  /** Speaks `text` in `language` and resolves once that utterance finishes (or errors/is
   * cancelled) — callers await this to know when it's safe to start the next utterance, which is
   * how `AnnouncementQueue` guarantees languages never overlap. No-ops (resolves immediately) if
   * speech synthesis isn't available or `text` is empty. */
  speak(text: string, language: LanguageCode, opts: SpeakOptions): Promise<void>;
  /** Stops whatever is currently speaking and drops anything queued at the browser level — does not
   * touch `AnnouncementQueue`'s own queue, callers clear that separately. */
  cancelAll(): void;
}

/** BCP-47 tag to fall back to when no matching installed voice exists, so the browser at least
 * attempts the right language's phonetics/prosody even without a locked voice identity. */
const FALLBACK_LANG_TAG: Readonly<Record<LanguageCode, string>> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
};

/** Preferred voice `lang` tags, most-specific first, for a natural Indian-accented reading of each
 * language — checked as exact matches, then as prefixes (some engines report `hi-IN-x` variants). */
const PREFERRED_LANG_TAGS: Readonly<Record<LanguageCode, readonly string[]>> = {
  en: ["en-in"],
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
 * reuses it for every subsequent announcement in that language — a consistent voice identity per
 * spec, never re-picked at random between calls — preferring an Indian-tagged/named voice and
 * falling back to whatever the platform actually has rather than failing silently.
 */
class WebSpeechVoiceProvider implements VoiceProvider {
  private voicesReadyPromise: Promise<void> | null = null;
  private readonly chosenVoice = new Map<LanguageCode, SpeechSynthesisVoice | null>();

  async speak(text: string, language: LanguageCode, opts: SpeakOptions): Promise<void> {
    if (!text || !hasSpeechSynthesis()) return;
    await this.ensureVoicesReady();
    const voice = this.resolveVoice(language);

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = FALLBACK_LANG_TAG[language];
      }
      // Calm, moderate-paced professional PA delivery — slightly below 1x, never the clipped
      // word-by-word cadence of a default TTS rate.
      utterance.rate = opts.rate ?? 0.93;
      utterance.pitch = 1;
      utterance.volume = Math.min(1, Math.max(0, opts.volume));
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
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

/**
 * The real fix for "sounds AI-generated": plays pre-synthesized, PA-processed clips from the
 * backend's `AnnouncementAudioService` (Google Cloud TTS, cached, run through a PA-style ffmpeg
 * filter chain — see `backend/.../announcement`) instead of the browser's own `speechSynthesis`.
 * Falls back to {@link WebSpeechVoiceProvider} whenever real audio genuinely isn't available —
 * no `AudioContext` yet, the backend returns `204` (no credentials configured, or synthesis
 * failed), a network error, or a corrupt/undecodable clip — so a missing credential degrades the
 * *voice quality*, never breaks the announcement entirely (spec §11).
 *
 * <p>A browser `Cache Storage` cache (`{@value CACHE_NAME}`) sits in front of the network call so
 * the same sentence spoken twice in one session (a repeated `NEXT_STATION` phrase, say) never
 * re-fetches — on top of the backend's own on-disk cache, this is belt-and-suspenders against the
 * spec's "never generate a new AI voice recording every time a train arrives."
 */
class CachedAudioVoiceProvider implements VoiceProvider {
  private readonly fallback: VoiceProvider = new WebSpeechVoiceProvider();
  private currentSource: AudioBufferSourceNode | null = null;
  private cachePromise: Promise<Cache | null> | null = null;

  async speak(text: string, language: LanguageCode, opts: SpeakOptions): Promise<void> {
    if (!text) return;

    const ctx = audioManager.getContext();
    const destination = audioManager.getAnnouncementDestination();
    if (!ctx || !destination) {
      return this.fallback.speak(text, language, opts);
    }

    const arrayBuffer = await this.loadAudio(text, language);
    if (!arrayBuffer) {
      return this.fallback.speak(text, language, opts);
    }

    try {
      // `decodeAudioData` detaches its input in most engines — decode a copy so `arrayBuffer`
      // (already cached, possibly still referenced elsewhere) is never silently neutered.
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      await this.play(ctx, destination, audioBuffer);
    } catch {
      await this.fallback.speak(text, language, opts);
    }
  }

  cancelAll(): void {
    this.currentSource?.stop();
    this.currentSource = null;
    this.fallback.cancelAll();
  }

  private play(ctx: AudioContext, destination: AudioNode, buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.onended = () => {
        if (this.currentSource === source) this.currentSource = null;
        resolve();
      };
      this.currentSource = source;
      source.start();
    });
  }

  private async loadAudio(text: string, language: LanguageCode): Promise<ArrayBuffer | null> {
    const cache = await this.openCache();
    const request = cacheRequestFor(text, language);

    if (cache) {
      const cached = await cache.match(request);
      if (cached) return cached.arrayBuffer();
    }

    const fetched = await fetchAnnouncementAudio(text, language);
    if (fetched && cache) {
      // Best-effort; a quota error here shouldn't block playing the clip we already have.
      void cache.put(request, new Response(fetched.slice(0), { headers: { "Content-Type": "audio/mpeg" } })).catch(() => {});
    }
    return fetched;
  }

  private openCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return Promise.resolve(null);
    if (!this.cachePromise) {
      this.cachePromise = caches.open(CACHE_NAME).catch(() => null);
    }
    return this.cachePromise;
  }
}

function cacheRequestFor(text: string, language: LanguageCode): Request {
  // Not a real endpoint — just a stable, content-addressed key for Cache Storage, which keys on
  // Request rather than an arbitrary string.
  return new Request(`https://announcement-audio.metrosim.local/${language}/${encodeURIComponent(text)}`);
}

export const voiceProvider: VoiceProvider = new CachedAudioVoiceProvider();
