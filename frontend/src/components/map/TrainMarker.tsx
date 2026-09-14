import type { TrainState } from "@/domain/trainsim";
import type { Point } from "@/lib/geometry/projection";

interface TrainMarkerProps {
  train: TrainState;
  point: Point;
  scale: number;
  colorHex: string;
  selected: boolean;
  onSelect: (train: TrainState) => void;
}

const HELD_STATUSES = new Set(["STOPPED", "DELAYED"]);

/**
 * A train's position on the map — a diamond (distinct from a station's circle) in its line's
 * color, counter-scaled like `StationMarker` so it stays a constant on-screen size at any zoom. A
 * red ring flags a train currently held for headway or past the delay threshold.
 */
export function TrainMarker({ train, point, scale, colorHex, selected, onSelect }: TrainMarkerProps) {
  const isHeld = HELD_STATUSES.has(train.status);

  return (
    <g
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      role="button"
      tabIndex={0}
      aria-label={`Train ${train.code}`}
      className="cursor-pointer outline-none"
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
      {selected && <circle r={9} fill="none" stroke="#38bdf8" strokeWidth={2} />}
      <rect
        x={-4.5}
        y={-4.5}
        width={9}
        height={9}
        transform="rotate(45)"
        fill={colorHex}
        stroke={isHeld ? "#f87171" : "#f1f5f9"}
        strokeWidth={isHeld ? 2 : 1.2}
      />
    </g>
  );
}
