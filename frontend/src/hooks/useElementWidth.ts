"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The measured content width of an element, tracked through resizes.
 *
 * Charts need this because the alternative — a fixed viewBox with
 * `preserveAspectRatio="none"` — stretches the coordinate space to fit the container, which
 * distorts every mark and forces `vector-effect="non-scaling-stroke"` on each one to compensate.
 * Rendering at true width removes the distortion instead of correcting for it.
 *
 * Returns 0 until the first measurement, which is the caller's cue to render nothing yet rather
 * than lay out against a guessed width and reflow a frame later.
 */
export function useElementWidth<T extends HTMLElement>(): readonly [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.contentRect.width;
      // Sub-pixel churn would re-render the whole chart on every scrollbar nudge.
      setWidth((current) => (Math.abs(current - next) < 1 ? current : next));
    });

    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
