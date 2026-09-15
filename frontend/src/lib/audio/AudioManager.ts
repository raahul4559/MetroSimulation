import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "@/domain/announcement";
import type { StationBuildType } from "@/domain/stationConfig";
import { playChime, playRumble, startAmbienceLoop } from "./synth";
import { createPaChain, updateListenerPosition, type PaChain } from "./pa";

const STORAGE_KEY = "metrosim.audioSettings";

/**
 * The audio surface for the 3D station feature's *non-speech* sound — door chimes, train rumble, the
 * ambient bed — plus the mute/volume/announcements/ambience/language settings a listener (the
 * station's audio control cluster, `AnnouncementService`) can read and change. Spoken announcements
 * themselves are a separate concern: see `lib/audio/VoiceProvider.ts` (the actual speech engine) and
 * `lib/announcements/AnnouncementService.ts` (the orchestrator), which read this manager's settings
 * but own their own playback. A module-level singleton, not a React context: `AudioContext`s are a
 * scarce, browser-capped resource, and this needs to survive `StationScene` mounting/unmounting as
 * the operator moves between stations rather than tearing one down and spinning up another each time.
 *
 * <p>Every real sound is either a real asset (checked once per path, then cached — see
 * {@link loadBuffer}) under {@code public/audio/<category>/<name>}, or, absent one, a small
 * procedural fallback from {@code synth.ts}. Nothing here decodes or regenerates audio per frame —
 * every method is called from a discrete event (a phase transition, a settings change), never from
 * `useFrame`.
 */
class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private settings: AudioSettings = loadSettings();
  private readonly listeners = new Set<(settings: AudioSettings) => void>();
  private ambience: { stop: () => void } | null = null;
  private readonly bufferCache = new Map<string, AudioBuffer | null>();
  private acousticBuildType: StationBuildType = "AT_GRADE";
  private paChain: { buildType: StationBuildType; chain: PaChain } | null = null;

  getSettings(): AudioSettings {
    return this.settings;
  }

  /** The shared `AudioContext`, for callers that need to decode audio themselves
   * (`CachedAudioVoiceProvider`) — `null` before {@link ensureContext} has run. Exposed as a getter
   * rather than handed out once, since it genuinely doesn't exist yet before the first user gesture. */
  getContext(): AudioContext | null {
    return this.ctx;
  }

  subscribe(listener: (settings: AudioSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSettings(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.applyVolume();
    if (this.settings.muted || !this.settings.ambienceEnabled) {
      this.stopAmbience();
    } else if (this.ctx) {
      this.startAmbience();
    }
    for (const listener of this.listeners) listener(this.settings);
  }

  /** Unlocks/creates the shared `AudioContext` — must be called from within a real user gesture
   * (browser autoplay policy), which is why `StationScene` wires this to the canvas's first
   * `pointerdown` rather than calling it on mount. Safe to call repeatedly. */
  ensureContext(): void {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyVolume();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (this.settings.ambienceEnabled && !this.settings.muted) this.startAmbience();
  }

  playDoorChime(kind: "open" | "close"): void {
    const ctx = this.ctx;
    const destination = this.masterGain;
    if (!ctx || !destination || this.settings.muted) return;
    void this.playAssetOr(`/audio/doors/${kind}.mp3`, ctx, destination, () => playChime(ctx, destination, kind));
  }

  playTrainRumble(intensity = 0.6, durationSeconds = 2.5): void {
    const ctx = this.ctx;
    const destination = this.masterGain;
    if (!ctx || !destination || this.settings.muted) return;
    void this.playAssetOr(`/audio/trains/rumble.mp3`, ctx, destination, () =>
      playRumble(ctx, destination, durationSeconds, intensity)
    );
  }

  /** Which acoustic coloring spoken announcements should route through — set once per station (see
   * `StationScene`'s effect keyed on `config.buildType`), read lazily by
   * {@link getAnnouncementDestination} the next time something needs to speak. Never rebuilds the
   * chain on every call: switching stations invalidates the cached chain via the `buildType`
   * mismatch check there, nothing more eager than that. */
  setAcousticContext(buildType: StationBuildType): void {
    this.acousticBuildType = buildType;
  }

  /** The node a synthesized announcement clip should connect to — routes it through the PA
   * processing graph (spatial position, room coloring, gentle compression; see `lib/audio/pa.ts`)
   * before it ever reaches {@link masterGain}. `null` only when there's no `AudioContext` yet (before
   * the first user gesture unlocks one via {@link ensureContext}) — callers treat that the same as
   * "nothing to play through," never as an error. */
  getAnnouncementDestination(): AudioNode | null {
    if (!this.ctx || !this.masterGain) return null;
    if (!this.paChain || this.paChain.buildType !== this.acousticBuildType) {
      this.paChain = {
        buildType: this.acousticBuildType,
        chain: createPaChain(this.ctx, this.masterGain, this.acousticBuildType),
      };
    }
    return this.paChain.chain.input;
  }

  /** Moves the PA graph's listener to track the 3D camera — see `AudioListenerSync`, which calls
   * this throttled as the operator moves around a station, never every render frame. A no-op before
   * the `AudioContext` exists. */
  updateListenerPosition(position: readonly [number, number, number], forward: readonly [number, number, number]): void {
    if (!this.ctx) return;
    updateListenerPosition(this.ctx, position, forward);
  }

  /** Called when a station scene unmounts. Deliberately does not close the shared `AudioContext` —
   * the operator is likely about to open another station, and browsers cap how many contexts can
   * exist at once, so the context is kept and reused rather than torn down and recreated. Spoken
   * announcements are a separate concern owned by `AnnouncementService`/`VoiceProvider` — callers
   * stop those themselves (see `StationScene`'s unmount effect) rather than this reaching into them. */
  leaveScene(): void {
    this.stopAmbience();
  }

  private applyVolume(): void {
    if (this.masterGain) this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.volume;
  }

  private startAmbience(): void {
    if (this.ambience || !this.ctx || !this.masterGain) return;
    this.ambience = startAmbienceLoop(this.ctx, this.masterGain);
  }

  private stopAmbience(): void {
    this.ambience?.stop();
    this.ambience = null;
  }

  private async playAssetOr(path: string, ctx: AudioContext, destination: GainNode, fallback: () => void): Promise<void> {
    const buffer = await this.loadBuffer(path, ctx);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.start();
      return;
    }
    fallback();
  }

  private async loadBuffer(path: string, ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(path)) return this.bufferCache.get(path) ?? null;
    try {
      const res = await fetch(path);
      if (!res.ok) {
        this.bufferCache.set(path, null);
        return null;
      }
      const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
      this.bufferCache.set(path, decoded);
      return decoded;
    } catch {
      this.bufferCache.set(path, null);
      return null;
    }
  }
}

export const audioManager = new AudioManagerImpl();

function loadSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    return { ...DEFAULT_AUDIO_SETTINGS, ...(JSON.parse(raw) as Partial<AudioSettings>) };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function saveSettings(settings: AudioSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort persistence only — a private-browsing quota error shouldn't break audio controls.
  }
}
