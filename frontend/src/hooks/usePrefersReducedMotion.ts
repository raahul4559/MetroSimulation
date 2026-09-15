"use client";

import { useEffect, useState } from "react";

/**
 * Whether the operator has asked for reduced motion.
 *
 * The CSS media query in globals.css handles everything driven by transitions and keyframes, but
 * it cannot reach a `requestAnimationFrame` tween — and the two longest movements in this app (the
 * map camera and the 2D→3D hand-off) are exactly that. Those need to read the preference in JS and
 * skip the animation outright rather than run it at zero duration.
 *
 * Starts `false` so server and client agree on the first render, then corrects on mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
