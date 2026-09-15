import { SURFACE_HEX } from "./tone";

/**
 * Line colour resolution.
 *
 * Line colours are backend data (`line.colorHex`, ultimately from `data/metro/lines.json`), not a
 * frontend constant — this module never invents one. What it does add is the *vivid* tier: the real
 * Namma Metro purple is #92278F, which against a near-black canvas is barely distinguishable from
 * the background. Strokes, line-coloured text and anything else that has to survive on a dark
 * surface reads through `lineVividColor`; solid fills and legend swatches keep the true brand hex.
 *
 * The lift is computed, not hand-tabled, so a line added to the dataset tomorrow gets the same
 * treatment without anyone remembering to update a map here.
 */

interface LineLike {
  readonly code: string;
  readonly colorHex: string;
}

/** Fallback for a line the network graph doesn't know about. Was a bare "#94a3b8" in four files. */
export const UNKNOWN_LINE_COLOR = SURFACE_HEX.secondary;

export function lineColor(line: LineLike | null | undefined): string {
  return line?.colorHex ?? UNKNOWN_LINE_COLOR;
}

export function lineColorByCode(
  lines: readonly LineLike[],
  code: string | null | undefined,
): string {
  if (!code) return UNKNOWN_LINE_COLOR;
  return lines.find((l) => l.code === code)?.colorHex ?? UNKNOWN_LINE_COLOR;
}

/**
 * The on-dark variant: same hue, raised luminance so it clears contrast against `--color-canvas`.
 * Brand-accurate colours that are already bright (yellow, green) barely move; dark ones (purple)
 * move a lot, which is exactly the point.
 */
export function vividize(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb);
  // Floor the lightness rather than scale it: dark hues get lifted, already-light hues stay put.
  // These three values are mirrored by the --color-line-*-vivid tokens in globals.css.
  const nextL = Math.max(l, 0.60);
  // Very dark sources also tend to be heavily saturated; easing that off keeps the lift from
  // reading as neon rather than as the same line, brighter.
  const nextS = l < 0.45 ? Math.min(s, 0.72) : s;
  return hslToHex({ h, s: nextS, l: nextL });
}

export function lineVividColor(line: LineLike | null | undefined): string {
  return vividize(lineColor(line));
}

export function lineVividColorByCode(
  lines: readonly LineLike[],
  code: string | null | undefined,
): string {
  return vividize(lineColorByCode(lines, code));
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}
interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

function parseHex(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = Number.parseInt(full, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  if (s === 0) return channelsToHex(l, l, l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return channelsToHex(hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3));
}

function hueToRgb(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

function channelsToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
