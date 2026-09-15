import { TONE_HEX } from "@/lib/ui/tone";

/**
 * Chart colours for the analytics dashboard.
 *
 * Status hues are no longer restated here — they resolve through the shared tone scale, so an
 * "at risk" amber on a chart is byte-identical to an "at risk" amber on a badge or an occupancy
 * bar. Previously this file held its own copy and three other files held three more, which is how
 * the app ended up with four different greens all meaning "good".
 *
 * Series colours stay distinct from status colours and are never reused for one: a line on a chart
 * must not be readable as a verdict.
 */
export const CHART_COLORS = {
  seriesPrimary: "#60a5fa",
  seriesSecondary: "#a78bfa",
  statusGood: TONE_HEX.positive,
  statusWarning: TONE_HEX.warning,
  statusCritical: TONE_HEX.danger,
} as const;

/** Chart chrome, pulled from the surface tokens so plots sit correctly on a panel. */
export const CHART_CHROME = {
  grid: "#1b1f24",
  axis: "#2f3339",
  crosshair: "#4a4f57",
  /** Halo behind an emphasised point, so it reads as lifted off the plot. */
  halo: "#0a0b0d",
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
