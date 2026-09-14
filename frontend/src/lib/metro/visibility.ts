import type { Station } from "@/domain/metro";

/** Regular (non-interchange, non-terminal) station labels only render once zoomed in this far. */
const REGULAR_LABEL_MIN_SCALE = 1.6;

/** A station renders only while at least one of its lines is toggled visible. */
export function isStationVisible(
  station: Pick<Station, "lines">,
  hiddenLineCodes: ReadonlySet<string>
): boolean {
  return station.lines.some((code) => !hiddenLineCodes.has(code));
}

/**
 * Interchange and terminal stations are always labelled (when labels are enabled at all) since
 * there are few of them and they anchor the map; regular stations only label once zoomed in
 * enough to have room, keeping the map readable rather than cluttered at the default zoom.
 */
export function shouldShowLabel(
  station: Pick<Station, "stationType">,
  scale: number,
  labelsEnabled: boolean
): boolean {
  if (!labelsEnabled) return false;
  if (station.stationType !== "REGULAR") return true;
  return scale >= REGULAR_LABEL_MIN_SCALE;
}
