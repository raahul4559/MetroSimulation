import type { TrainState } from "@/domain/trainsim";
import type { Point } from "@/lib/geometry/projection";
import { SURFACE_HEX, TONE_HEX } from "@/lib/ui/tone";
import { vividize } from "@/lib/ui/lineColor";
import { trainSourceLabel } from "@/lib/realtime/provenance";

interface TrainMarkerProps {
  train: TrainState;
  point: Point;
  scale: number;
  colorHex: string;
  selected: boolean;
  dimmed?: boolean;
  onSelect: (train: TrainState) => void;
  /**
   * When given, the map's animation loop owns this marker's position: the marker registers its
   * element here and React never writes `transform` (a re-render would otherwise yank it back to
   * the raw keyframe mid-blend). Without it, the marker is drawn statically at `point`.
   */
  registerMarker?: ((trainId: number, element: SVGGElement | null) => void) | undefined;
}

/** The marker's transform for a projected point at the current zoom — shared with the map's
 * animation loop so the render and the loop can never disagree on the format. */
export function trainMarkerTransform(point: Point, scale: number): string {
  return `translate(${point.x} ${point.y}) scale(${1 / scale})`;
}

const HELD_STATUSES = new Set(["STOPPED", "DELAYED"]);

/**
 * A train's position on the map.
 *
 * A small rounded chip elongated along the direction of travel — deliberately a different shape
 * language from a station's circle and a signal's square, so the three are distinguishable at a
 * glance without relying on colour. Counter-scaled like `StationMarker` so it stays a constant
 * on-screen size at any zoom. An amber ring flags a train currently held for headway or past the
 * delay threshold. A stale observation (the feed hasn't placed it recently) is drawn faded with a
 * dashed outline — it is where the train *was*, not where it is.
 */
export function TrainMarker({
  train,
  point,
  scale,
  colorHex,
  selected,
  dimmed = false,
  onSelect,
  registerMarker,
}: TrainMarkerProps) {
  const isHeld = HELD_STATUSES.has(train.status);
  const stale = train.stale;

  return (
    <g
      ref={registerMarker ? (element) => registerMarker(train.id, element) : undefined}
      transform={registerMarker ? undefined : trainMarkerTransform(point, scale)}
      role="button"
      tabIndex={0}
      aria-label={`Train ${train.code}, ${trainSourceLabel(train)}`}
      className="cursor-pointer outline-none transition-opacity duration-(--duration-base)"
      opacity={dimmed ? 0.35 : stale ? 0.55 : 1}
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
        stroke={isHeld || stale ? TONE_HEX.warning : SURFACE_HEX.canvas}
        strokeWidth={isHeld || stale ? 1.75 : 1.25}
        {...(stale && { strokeDasharray: "2 1.5" })}
      />
    </g>
  );
}
