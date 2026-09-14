/** Chart colors for the analytics dashboard, picked from this app's existing Tailwind slate/blue
 * dark theme rather than the dataviz skill's generic reference hex — see that skill's guidance on
 * substituting a design system's own values. `statusGood`/`Warning`/`Critical` intentionally match
 * `StatusBadge`'s existing emerald/amber/red tones so a color means the same thing everywhere in
 * this app, and are never reused for a plain (non-status) series. */
export const CHART_COLORS = {
  seriesPrimary: "#60a5fa", // blue-400
  seriesSecondary: "#a78bfa", // violet-400
  statusGood: "#10b981", // emerald-500
  statusWarning: "#f59e0b", // amber-500
  statusCritical: "#ef4444", // red-500
} as const;

export function congestionColor(level: "LOW" | "MEDIUM" | "HIGH"): string {
  switch (level) {
    case "HIGH":
      return CHART_COLORS.statusCritical;
    case "MEDIUM":
      return CHART_COLORS.statusWarning;
    default:
      return CHART_COLORS.statusGood;
  }
}

/** Wait-time buckets are ordered short → long; the first two read as fine, the middle as a
 * building problem, the last as severe — a severity ramp over the same three status hues used for
 * station congestion, not a fifth arbitrary color. */
export function waitBucketColor(index: number): string {
  if (index <= 1) return CHART_COLORS.statusGood;
  if (index <= 3) return CHART_COLORS.statusWarning;
  return CHART_COLORS.statusCritical;
}
