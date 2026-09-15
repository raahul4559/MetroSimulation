import type { Tone } from "@/lib/ui/tone";

/**
 * When a number counts as fine, watch-it, or wrong.
 *
 * These are operational judgements, not styling, and they were previously written as ternaries
 * inline in the dashboard's JSX — which meant "what is an acceptable on-time percentage" was a
 * decision buried in markup, stated once, impossible to find, and impossible to reuse on the
 * operations view. Naming them here makes them reviewable.
 */

/** Below 75% on-time is a service that is visibly failing; 90% is the target. */
const ON_TIME_TARGET_PCT = 90;
const ON_TIME_FLOOR_PCT = 75;

/** A worst-case delay past two minutes is the point at which headway starts to bunch. */
const MAX_DELAY_CRITICAL_SECONDS = 120;

export function onTimeTone(pct: number): Tone {
  if (pct >= ON_TIME_TARGET_PCT) return "positive";
  if (pct >= ON_TIME_FLOOR_PCT) return "warning";
  return "danger";
}

export function maxDelayTone(seconds: number): Tone {
  return seconds > MAX_DELAY_CRITICAL_SECONDS ? "danger" : "neutral";
}

/** Any delay at all is worth flagging amber; zero is the only "good" value. */
export function avgDelayTone(seconds: number): Tone {
  return seconds > 0 ? "warning" : "positive";
}

/** Counts where the only acceptable value is zero — disruptions, passengers left behind. */
export function zeroIsGoodTone(count: number): Tone {
  return count > 0 ? "warning" : "positive";
}
