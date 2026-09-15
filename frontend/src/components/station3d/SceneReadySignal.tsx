"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Reports the first genuinely drawn frames of a freshly mounted scene.
 *
 * This is the only reliable "the WebGL scene has actually painted" signal. Asset resolution is not
 * enough: shader compilation and the first render pass happen after `useGLTF` resolves, so a
 * transition that reveals on asset-ready shows a blank canvas for a beat.
 *
 * Two frames, not one — the first `useFrame` can run before materials have compiled, and that is
 * precisely the frame that shows up as a white flash if you reveal on it.
 *
 * Lives inside `<Canvas>` because it needs R3F's frameloop; the callback it fires is consumed
 * outside, by whoever owns the transition.
 */
export function SceneReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const fired = useRef(false);

  useFrame(() => {
    if (fired.current) return;
    frames.current += 1;
    if (frames.current < 2) return;
    fired.current = true;
    onReady();
  });

  return null;
}
