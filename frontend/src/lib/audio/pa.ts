import type { StationBuildType } from "@/domain/stationConfig";

/** Everything a caller needs to route audio through the PA chain — connect your source node to
 * {@link input}. */
export interface PaChain {
  readonly input: AudioNode;
}

/** How long/dense each build type's synthetic room reflection is — underground stations (concrete,
 * enclosed) get a touch more tail than an open elevated platform, which is closer to outdoor
 * acoustics. Short on purpose: the spec asks for "very subtle" coloring and "controlled reverb,"
 * not a cavern. */
const IMPULSE_RESPONSE_SECONDS: Readonly<Record<StationBuildType, number>> = {
  UNDERGROUND: 0.4,
  AT_GRADE: 0.18,
  ELEVATED: 0.15,
};

/** How much of the reverb tail is mixed in — deliberately small; the announcement must stay highly
 * intelligible (spec §4), so this is coloring, not an effect you're meant to consciously notice. */
const WET_MIX = 0.16;

const impulseResponseCache = new WeakMap<AudioContext, Map<StationBuildType, AudioBuffer>>();

/** Builds (once per context+build-type, then cached) the PA processing graph an announcement clip
 * plays through: a fixed-position `PannerNode` (every announcement comes from the same PA speaker
 * anchor, not from wherever the train happens to be — matching how a real platform's fixed speakers
 * work), mixed dry/wet through a `ConvolverNode` for the acoustic coloring, then a gentle
 * `DynamicsCompressorNode` before handing off to the caller's destination (normally
 * `AudioManager`'s master gain).
 */
export function createPaChain(ctx: AudioContext, destination: AudioNode, buildType: StationBuildType): PaChain {
  const panner = ctx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 4;
  panner.maxDistance = 60;
  panner.rolloffFactor = 1;
  setPannerPosition(panner, 0, 3.2, -2); // a fixed overhead PA-speaker anchor, not the train

  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  convolver.buffer = getImpulseResponse(ctx, buildType);

  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = 1 - WET_MIX;
  wet.gain.value = WET_MIX;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.15;

  panner.connect(dry);
  panner.connect(convolver);
  convolver.connect(wet);
  dry.connect(compressor);
  wet.connect(compressor);
  compressor.connect(destination);

  return { input: panner };
}

/** Moves the shared `AudioListener` to `position`, facing `forward` — called (throttled, see
 * `AudioListenerSync`) as the operator moves the 3D camera, so distance/direction to the fixed PA
 * anchor above actually changes with where they're standing. Not called per audio-graph frame or
 * per announcement; this only ever writes a position, never touches decoded audio. */
export function updateListenerPosition(
  ctx: AudioContext,
  position: readonly [number, number, number],
  forward: readonly [number, number, number]
): void {
  const listener = ctx.listener;
  const [x, y, z] = position;
  const [fx, fy, fz] = forward;
  if (listener.positionX) {
    const t = ctx.currentTime;
    listener.positionX.setTargetAtTime(x, t, 0.1);
    listener.positionY.setTargetAtTime(y, t, 0.1);
    listener.positionZ.setTargetAtTime(z, t, 0.1);
    listener.forwardX.setTargetAtTime(fx, t, 0.1);
    listener.forwardY.setTargetAtTime(fy, t, 0.1);
    listener.forwardZ.setTargetAtTime(fz, t, 0.1);
    listener.upX.setTargetAtTime(0, t, 0.1);
    listener.upY.setTargetAtTime(1, t, 0.1);
    listener.upZ.setTargetAtTime(0, t, 0.1);
  } else {
    // Safari (as of writing) only exposes the deprecated imperative API.
    listener.setPosition(x, y, z);
    listener.setOrientation(fx, fy, fz, 0, 1, 0);
  }
}

function setPannerPosition(panner: PannerNode, x: number, y: number, z: number): void {
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    panner.setPosition(x, y, z);
  }
}

function getImpulseResponse(ctx: AudioContext, buildType: StationBuildType): AudioBuffer {
  let perContext = impulseResponseCache.get(ctx);
  if (!perContext) {
    perContext = new Map();
    impulseResponseCache.set(ctx, perContext);
  }
  const cached = perContext.get(buildType);
  if (cached) return cached;

  const durationSeconds = IMPULSE_RESPONSE_SECONDS[buildType];
  const length = Math.max(1, Math.round(ctx.sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Exponentially-decaying filtered noise — a cheap, dependency-free synthetic room impulse.
      // Underground's longer window (see IMPULSE_RESPONSE_SECONDS) reads as a denser tail even with
      // the same decay curve, without needing a second shape parameter.
      const decay = Math.pow(1 - t, 2.2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  perContext.set(buildType, buffer);
  return buffer;
}
