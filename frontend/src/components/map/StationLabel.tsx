import type { Station } from "@/domain/metro";
import type { Point } from "@/lib/geometry/projection";
import { SURFACE_HEX } from "@/lib/ui/tone";

interface StationLabelProps {
  station: Station;
  point: Point;
  scale: number;
  visible: boolean;
  /** Emphasised when this station is the current selection. */
  active?: boolean;
  dimmed?: boolean;
}

/** A station's name, counter-scaled like `StationMarker` so text stays legible at any zoom. The
 * halo is painted in the canvas colour so a label crossing a line still reads cleanly. */
export function StationLabel({
  station,
  point,
  scale,
  visible,
  active = false,
  dimmed = false,
}: StationLabelProps) {
  if (!visible) return null;

  const isInterchange = station.stationType === "INTERCHANGE";
  const offset = isInterchange ? 13 : 10;

  return (
    <text
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      y={-offset}
      textAnchor="middle"
      fontSize={active ? 11 : 10}
      fontWeight={isInterchange || active ? 600 : 400}
      fill={isInterchange || active ? SURFACE_HEX.content : SURFACE_HEX.secondary}
      opacity={dimmed ? 0.3 : 1}
      className="pointer-events-none select-none transition-opacity duration-(--duration-base)"
      style={{ paintOrder: "stroke", stroke: SURFACE_HEX.canvas, strokeWidth: 3.5 }}
    >
      {station.name}
    </text>
  );
}
