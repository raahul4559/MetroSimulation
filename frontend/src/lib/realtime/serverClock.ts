/**
 * The backend's clock, as seen from this browser. The server timestamp is authoritative: a
 * laptop whose clock is a few minutes off must not show a different "now", or compute different
 * ETAs, from every other screen.
 *
 * Every sample is `serverEpochMillis - localReceiveTime`. A message can only arrive *after* it was
 * stamped, so each sample underestimates the true offset by that message's latency; the largest
 * recent sample is therefore the best estimate (the least-delayed message). A bounded window lets
 * the estimate follow a genuine clock adjustment on either side.
 *
 * Measured against a monotonic local clock (`performance.timeOrigin + performance.now()`), not
 * `Date.now()`, so changing the computer's clock or timezone doesn't move the displayed server
 * time. Some browsers pause the monotonic clock while the machine sleeps; any divergence between
 * the two local clocks therefore marks the offset as needing a re-sync. Nothing here ever reads the
 * browser's timezone.
 *
 * Module-level rather than React state on purpose: it changes rarely, everything that formats a
 * time needs it, and chrome rendered outside the live provider (the navbar clock) reads it too.
 */

const WINDOW = 30;
/** Without fresh samples for this long (no realtime stream on this page), re-sync over REST. */
export const RESYNC_AFTER_MS = 5 * 60_000;
const samples: number[] = [];
let offsetMs = 0;
let synced = false;
let lastSampleAt = Number.NEGATIVE_INFINITY;
/** `Date.now() - localNowMs()` when the last sample arrived; it only changes if one of the two
 * local clocks jumped (wall clock adjusted, or the monotonic clock paused during sleep). */
let wallMinusMonotonicAtSample = 0;
const CLOCK_JUMP_MS = 2_000;

/** The browser's own clock, monotonic: epoch-ms at page load plus elapsed time since. */
export function localNowMs(): number {
  return typeof performance !== "undefined" && Number.isFinite(performance.timeOrigin)
    ? performance.timeOrigin + performance.now()
    : Date.now();
}

/** Record a server timestamp received at `receivedAtMs` (a {@link localNowMs} reading). */
export function recordServerTime(serverEpochMillis: number, receivedAtMs: number = localNowMs()): void {
  if (!Number.isFinite(serverEpochMillis)) return;
  samples.push(serverEpochMillis - receivedAtMs);
  if (samples.length > WINDOW) samples.shift();
  offsetMs = Math.max(...samples);
  synced = true;
  lastSampleAt = localNowMs();
  wallMinusMonotonicAtSample = Date.now() - lastSampleAt;
}

/** True when no sample has arrived recently enough to trust the offset. */
export function serverClockNeedsSync(): boolean {
  if (!synced) return true;
  const now = localNowMs();
  if (Math.abs(Date.now() - now - wallMinusMonotonicAtSample) > CLOCK_JUMP_MS) {
    // A local clock jumped. Old samples were taken against the old relationship; drop them.
    samples.length = 0;
    return true;
  }
  return now - lastSampleAt > RESYNC_AFTER_MS;
}

/** Milliseconds to add to the local clock to get server time. 0 until the first sample. */
export function serverClockOffsetMs(): number {
  return offsetMs;
}

export function isServerClockSynced(): boolean {
  return synced;
}

/** The current server time, in epoch milliseconds. */
export function serverNowMs(): number {
  return localNowMs() + offsetMs;
}

/** The canonical timezone of the whole system — matches the backend's `MetroTime.ZONE`. */
export const METRO_TIME_ZONE = "Asia/Kolkata";

const timeOfDayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: METRO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: METRO_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "medium",
});

/** HH:MM:SS in IST, regardless of the viewer's own timezone. */
export function formatIstTimeOfDay(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "--:--:--";
  return timeOfDayFormat.format(epochMs);
}

const shortDateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: METRO_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const hourMinuteFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: METRO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "05:00" in IST. */
export function formatIstHourMinute(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "--:--";
  return hourMinuteFormat.format(epochMs);
}

/** The IST calendar date as "YYYY-MM-DD" — for comparing days without the viewer's timezone. */
export function istDateKey(epochMs: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: METRO_TIME_ZONE }).format(epochMs);
}

/** "Tue, 13 Oct" in IST. */
export function formatIstShortDate(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "—";
  return shortDateFormat.format(epochMs);
}

/** "12 Oct 2026, 09:30:00 IST". */
export function formatIstDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "—";
  return `${dateTimeFormat.format(epochMs)} IST`;
}
