import type { Signal } from "@/domain/trainsim";
import type { Point } from "@/lib/geometry/projection";

interface SignalMarkerProps {
  signal: Signal;
  point: Point;
  scale: number;
}

const ASPECT_COLOR: Record<Signal["aspect"], string> = {
  GREEN: "#22c55e",
  YELLOW: "#f59e0b",
  RED: "#ef4444",
};

/** A block signal on the map — a small square (distinct from stations' circles and trains'
 * diamonds) at the entrance to the block it protects, colored by aspect. Counter-scaled like
 * `StationMarker`/`TrainMarker` so it stays a constant, small size at any zoom. GREEN signals are
 * drawn faint (the common case, not worth calling attention to); YELLOW/RED are fully opaque since
 * they're what a reader actually wants to notice. */
export function SignalMarker({ signal, point, scale }: SignalMarkerProps) {
  const isActive = signal.aspect !== "GREEN";

  return (
    <rect
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      x={-2.5}
      y={-2.5}
      width={5}
      height={5}
      fill={ASPECT_COLOR[signal.aspect]}
      fillOpacity={isActive ? 1 : 0.45}
      stroke="#0f172a"
      strokeWidth={0.75}
      className="pointer-events-none"
    />
  );
}
