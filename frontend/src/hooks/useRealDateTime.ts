"use client";

import { useEffect, useState } from "react";

/** The operator's wall clock, ticking once a second. Separate from the simulation clock, which
 * arrives over the socket and runs at whatever speed multiplier is set. */
export function useRealDateTime(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
