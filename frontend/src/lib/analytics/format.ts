export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "0%";
  return `${pct.toFixed(1)}%`;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatSpeed(kmph: number): string {
  if (!Number.isFinite(kmph)) return "0 km/h";
  return `${kmph.toFixed(1)} km/h`;
}

/** Formats simulated-elapsed-seconds as an "Hh Mm" duration since simulation start — used as the
 * x-axis label on historical charts, since these are simulated ticks, not wall-clock reads. */
export function formatElapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
