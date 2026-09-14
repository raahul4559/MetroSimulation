import type { Station } from "@/domain/metro";
import type { Point } from "@/lib/geometry/projection";

interface StationLabelProps {
  station: Station;
  point: Point;
  scale: number;
  visible: boolean;
}

/** A station's name, counter-scaled like `StationMarker` so text stays legible at any zoom. */
export function StationLabel({ station, point, scale, visible }: StationLabelProps) {
  if (!visible) return null;

  const isInterchange = station.stationType === "INTERCHANGE";
  const offset = isInterchange ? 12 : 9;

  return (
    <text
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      y={-offset}
      textAnchor="middle"
      fontSize={10}
      fontWeight={isInterchange ? 600 : 400}
      fill={isInterchange ? "#f1f5f9" : "#cbd5e1"}
      className="pointer-events-none select-none"
      style={{ paintOrder: "stroke", stroke: "#0f172a", strokeWidth: 3 }}
    >
      {station.name}
    </text>
  );
}
