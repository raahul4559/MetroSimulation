import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "@/domain/announcement";
import { playChime, playRumble, startAmbienceLoop } from "./synth";

const STORAGE_KEY = "metrosim.audioSettings";

/**
 * The one audio surface for the whole 3D station feature — door chimes, train rumble, the ambient
 * bed, and spoken announcements, plus the mute/volume/announcements/ambience settings a listener
 * (the station's audio control cluster) can read and change. A module-level singleton, not a React
 * context: `AudioContext`s are a scarce, browser-capped resource, and this needs to survive
 * `StationScene` mounting/unmounting as the operator moves between stations rather than tearing one
 * down and spinning up another each time.
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

  getSettings(): AudioSettings {
    return this.settings;
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

  /** Speaks an announcement via the browser's speech synthesis — clearly a synthesized voice, never
   * presented as a real recording (see `public/audio/announcements/README.md`). No-ops quietly if
   * the browser has no speech synthesis support, muted, or announcements are turned off. */
  speak(text: string): void {
    if (!text || this.settings.muted || !this.settings.announcementsEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.settings.volume;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  /** Called when a station scene unmounts. Deliberately does not close the shared `AudioContext` —
   * the operator is likely about to open another station, and browsers cap how many contexts can
   * exist at once, so the context is kept and reused rather than torn down and recreated. */
  leaveScene(): void {
    this.stopAmbience();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
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
