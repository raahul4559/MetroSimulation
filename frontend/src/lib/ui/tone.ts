/**
 * The single semantic colour scale.
 *
 * Before this existed the same four-name idea was declared independently in five files with two
 * incompatible naming schemes, and "good green" resolved to four different hex values depending
 * on which component you happened to be looking at. Everything that wants to say "this is fine /
 * this needs attention / this is wrong" now says it here.
 *
 * Two representations, because they have genuinely different consumers:
 *   TONE_CLASSES — Tailwind classes, for DOM elements.
 *   TONE_HEX     — resolved hex, for SVG attributes and three.js materials, neither of which can
 *                  read a Tailwind class. These MUST stay in sync with the tokens in globals.css.
 */
export type Tone = "neutral" | "positive" | "warning" | "danger" | "info";

/** Legacy alias used by the analytics tiles before the scale was unified. */
export type LegacyTone = "neutral" | "good" | "warning" | "critical";

export function fromLegacyTone(tone: LegacyTone): Tone {
  switch (tone) {
    case "good":
      return "positive";
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    case "neutral":
      return "neutral";
  }
}

export interface ToneClasses {
  /** Foreground text in this tone. */
  readonly text: string;
  /** Solid background used for dots and bar fills. */
  readonly dot: string;
  /** Tinted chip surface + hairline, for badges. */
  readonly chip: string;
}

export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  neutral: {
    text: "text-secondary",
    dot: "bg-secondary",
    chip: "bg-white/5 text-secondary ring-1 ring-inset ring-edge",
  },
  positive: {
    text: "text-positive",
    dot: "bg-positive",
    chip: "bg-positive/10 text-positive ring-1 ring-inset ring-positive/25",
  },
  warning: {
    text: "text-warning",
    dot: "bg-warning",
    chip: "bg-warning/10 text-warning ring-1 ring-inset ring-warning/25",
  },
  danger: {
    text: "text-danger",
    dot: "bg-danger",
    chip: "bg-danger/10 text-danger ring-1 ring-inset ring-danger/25",
  },
  info: {
    text: "text-info",
    dot: "bg-info",
    chip: "bg-info/10 text-info ring-1 ring-inset ring-info/25",
  },
};

/** Mirrors the tone tokens in globals.css for consumers that cannot use classes (SVG, three.js). */
export const TONE_HEX: Record<Tone, string> = {
  neutral: "#a2a8b0",
  positive: "#2ed47a",
  warning: "#f5a524",
  danger: "#f0576b",
  info: "#4c8df6",
};

/** Neutral surface/edge values needed by SVG chrome (gridlines, label halos, axes). */
export const SURFACE_HEX = {
  canvas: "#0a0b0d",
  surface: "#121417",
  sunken: "#07080a",
  divider: "#23262b",
  edge: "#2f3339",
  muted: "#6b7279",
  secondary: "#a2a8b0",
  content: "#f2f4f6",
} as const;
