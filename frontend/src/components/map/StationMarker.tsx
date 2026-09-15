import type { Station } from "@/domain/metro";
import type { Point } from "@/lib/geometry/projection";
import { DENSITY_COLOR, densityLevel } from "@/lib/metro/passengerDisplay";
import { SURFACE_HEX, TONE_HEX } from "@/lib/ui/tone";

interface StationMarkerProps {
  station: Station;
  point: Point;
  scale: number;
  selected: boolean;
  /** Passengers currently waiting at this station (see `buildStationQueueCounts`) — `0`/absent
   * renders the marker exactly as it did before passenger demand existed. */
  waitingCount?: number;
  /** Operator preference: the density halo can be turned off entirely. */
  showDensity?: boolean;
  /** Recedes this marker when something else is selected. */
  dimmed?: boolean;
  onSelect: (station: Station) => void;
}

/**
 * A station node. Wrapped in its own `translate → scale(1/zoom)` group so the marker stays a
 * constant on-screen size at any map zoom level, independent of the shared pan/zoom transform
 * applied to the map as a whole. A halo behind the station dot encodes passenger density — its
 * radius and colour both grow with the waiting queue, so a crowded station reads as "bigger and
 * busier" even before a viewer stops to read numbers.
 */
export function StationMarker({
  station,
  point,
  scale,
  selected,
  waitingCount = 0,
  showDensity = true,
  dimmed = false,
  onSelect,
}: StationMarkerProps) {
  const isInterchange = station.stationType === "INTERCHANGE";
  const isTerminal = station.stationType === "TERMINAL";
  const density = densityLevel(waitingCount);
  const haloRadius = showDensity ? { low: 0, moderate: 10, high: 14, crowded: 19 }[density] : 0;

  return (
    <g
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      role="button"
      tabIndex={0}
      aria-label={`${station.name} station${waitingCount > 0 ? `, ${waitingCount} waiting` : ""}`}
      className="cursor-pointer outline-none transition-opacity duration-(--duration-base)"
      opacity={dimmed ? 0.35 : 1}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(station);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(station);
        }
      }}
    >
      {haloRadius > 0 && (
        <circle r={haloRadius} fill={DENSITY_COLOR[density]} opacity={0.22} />
      )}
      {selected && (
        <>
          {/* A soft outer ring plus a crisp inner one: visible against both the dark canvas and a
              line colour running underneath the marker. */}
          <circle r={isInterchange ? 15 : 12} fill={TONE_HEX.info} opacity={0.18} />
          <circle
            r={isInterchange ? 11 : 9}
            fill="none"
            stroke={TONE_HEX.info}
            strokeWidth={1.75}
          />
        </>
      )}
      {isInterchange ? (
        <>
          <circle r={7} fill={SURFACE_HEX.canvas} stroke={SURFACE_HEX.content} strokeWidth={2} />
          <circle r={3} fill={SURFACE_HEX.content} />
        </>
      ) : (
        <circle
          r={isTerminal ? 5 : 3.5}
          fill={SURFACE_HEX.canvas}
          stroke={isTerminal ? SURFACE_HEX.content : SURFACE_HEX.secondary}
          strokeWidth={isTerminal ? 2 : 1.5}
        />
      )}
    </g>
  );
}
