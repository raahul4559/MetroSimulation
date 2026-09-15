import type { TrainState } from "@/domain/trainsim";
import type { Point } from "@/lib/geometry/projection";
import { SURFACE_HEX, TONE_HEX } from "@/lib/ui/tone";
import { vividize } from "@/lib/ui/lineColor";

interface TrainMarkerProps {
  train: TrainState;
  point: Point;
  scale: number;
  colorHex: string;
  selected: boolean;
  dimmed?: boolean;
  onSelect: (train: TrainState) => void;
}

const HELD_STATUSES = new Set(["STOPPED", "DELAYED"]);

/**
 * A train's position on the map.
 *
 * A small rounded chip elongated along the direction of travel — deliberately a different shape
 * language from a station's circle and a signal's square, so the three are distinguishable at a
 * glance without relying on colour. Counter-scaled like `StationMarker` so it stays a constant
 * on-screen size at any zoom. An amber ring flags a train currently held for headway or past the
 * delay threshold.
 */
export function TrainMarker({
  train,
  point,
  scale,
  colorHex,
  selected,
  dimmed = false,
  onSelect,
}: TrainMarkerProps) {
  const isHeld = HELD_STATUSES.has(train.status);

  return (
    <g
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      role="button"
      tabIndex={0}
      aria-label={`Train ${train.code}`}
      className="cursor-pointer outline-none transition-opacity duration-(--duration-base)"
      opacity={dimmed ? 0.35 : 1}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(train);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(train);
        }
      }}
    >
      {selected && (
        <>
          <circle r={11} fill={TONE_HEX.info} opacity={0.18} />
          <circle r={8} fill="none" stroke={TONE_HEX.info} strokeWidth={1.75} />
        </>
      )}
      <rect
        x={-5}
        y={-3.25}
        width={10}
        height={6.5}
        rx={3.25}
        fill={vividize(colorHex)}
        stroke={isHeld ? TONE_HEX.warning : SURFACE_HEX.canvas}
        strokeWidth={isHeld ? 1.75 : 1.25}
      />
    </g>
  );
}
