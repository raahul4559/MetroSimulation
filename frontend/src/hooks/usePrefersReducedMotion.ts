"use client";

import { useCallback, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the operator has asked for reduced motion.
 *
 * The CSS media query in globals.css handles everything driven by transitions and keyframes, but
 * it cannot reach a `requestAnimationFrame` tween — and the two longest movements in this app (the
 * map camera and the 2D→3D hand-off) are exactly that. Those need to read the preference in JS and
 * skip the animation outright rather than run it at zero duration.
 *
 * `useSyncExternalStore` rather than an effect: the media query *is* an external store, and this
 * is the primitive for subscribing to one. It also gives a clean server snapshot (`false`), so the
 * first client render matches the server's instead of correcting itself a frame later.
 */
export function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia(QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
