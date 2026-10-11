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
 * Module-level rather than React state on purpose: it changes rarely, everything that formats a
 * time needs it, and chrome rendered outside the live provider (the navbar clock) reads it too.
 */

const WINDOW = 30;
const samples: number[] = [];
let offsetMs = 0;
let synced = false;

export function recordServerTime(serverEpochMillis: number, receivedAtMs: number = Date.now()): void {
  if (!Number.isFinite(serverEpochMillis)) return;
  samples.push(serverEpochMillis - receivedAtMs);
  if (samples.length > WINDOW) samples.shift();
  offsetMs = Math.max(...samples);
  synced = true;
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
  return Date.now() + offsetMs;
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

/** "12 Oct 2026, 09:30:00 IST". */
export function formatIstDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return "—";
  return `${dateTimeFormat.format(epochMs)} IST`;
}
