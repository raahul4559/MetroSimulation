/**
 * Procedurally-generated placeholder sounds — the fallback `AudioManager` reaches for whenever no
 * real asset exists under `public/audio/**` (see that file's `loadBuffer`). Deliberately simple
 * synthesis (a couple of enveloped oscillators, filtered noise) so the station is never silent, and
 * deliberately NOT trying to sound like a real recording — this project has no licensed Namma Metro
 * audio to ship, and the spec is explicit that simulated audio must never pass as authentic.
 */

/** A short two-tone chime — rising for a door opening, falling for a door closing. */
export function playChime(ctx: AudioContext, destination: AudioNode, kind: "open" | "close"): void {
  const now = ctx.currentTime;
  const freqs = kind === "open" ? [880, 1174.66] : [1174.66, 880];
  for (const [i, freq] of freqs.entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.5, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
    osc.connect(gain).connect(destination);
    osc.start(start);
    osc.stop(start + 0.34);
  }
}

/** A short filtered-noise rumble for a train approaching or pulling away. */
export function playRumble(ctx: AudioContext, destination: AudioNode, durationSeconds: number, intensity: number): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, durationSeconds, intensity);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 220;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.35 * intensity, now + durationSeconds * 0.3);
  gain.gain.linearRampToValueAtTime(0, now + durationSeconds);
  source.connect(filter).connect(gain).connect(destination);
  source.start(now);
  source.stop(now + durationSeconds);
}

/** A continuous, quiet filtered-noise bed — started once and looped, never regenerated per frame. */
export function startAmbienceLoop(ctx: AudioContext, destination: AudioNode): { stop: () => void } {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 2, 0.2);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.value = 0.1;
  source.connect(filter).connect(gain).connect(destination);
  source.start();
  return {
    stop: () => {
      source.stop();
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    },
  };
}

function noiseBuffer(ctx: AudioContext, durationSeconds: number, amplitude: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * amplitude;
  return buffer;
}
