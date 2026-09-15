import type { Signal } from "@/domain/trainsim";
import type { Point } from "@/lib/geometry/projection";
import { SURFACE_HEX, TONE_HEX } from "@/lib/ui/tone";

interface SignalMarkerProps {
  signal: Signal;
  point: Point;
  scale: number;
}

const ASPECT_COLOR: Record<Signal["aspect"], string> = {
  GREEN: TONE_HEX.positive,
  YELLOW: TONE_HEX.warning,
  RED: TONE_HEX.danger,
};

/** A block signal on the map — a small square (distinct from stations' circles and trains'
 * rounded chips) at the entrance to the block it protects, colored by aspect. Counter-scaled like
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
      rx={1}
      fill={ASPECT_COLOR[signal.aspect]}
      fillOpacity={isActive ? 1 : 0.4}
      stroke={SURFACE_HEX.canvas}
      strokeWidth={0.75}
      className="pointer-events-none"
    />
  );
}
