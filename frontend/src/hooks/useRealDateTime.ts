"use client";

import { useEffect, useState } from "react";
import { serverNowMs } from "@/lib/realtime/serverClock";

/** The real wall clock, ticking once a second — the *server's* time, corrected from this
 * browser's clock by the offset learned from realtime frames, so every screen agrees. Separate
 * from the simulation clock, which runs at whatever speed multiplier is set. */
export function useRealDateTime(): Date {
  const [now, setNow] = useState(() => new Date(serverNowMs()));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date(serverNowMs())), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
