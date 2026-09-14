import type { Station } from "@/domain/metro";
import type { Point } from "@/lib/geometry/projection";
import { densityLevel, DENSITY_COLOR } from "@/lib/metro/passengerDisplay";

interface StationMarkerProps {
  station: Station;
  point: Point;
  scale: number;
  selected: boolean;
  /** Passengers currently waiting at this station (see `buildStationQueueCounts`) — `0`/absent
   * renders the marker exactly as it did before passenger demand existed. */
  waitingCount?: number;
  onSelect: (station: Station) => void;
}

/**
 * A station node. Wrapped in its own `translate → scale(1/zoom)` group so the marker stays a
 * constant on-screen size at any map zoom level, independent of the shared pan/zoom transform
 * applied to the map as a whole. A halo behind the station dot encodes passenger density — its
 * radius and colour both grow with the waiting queue, so a crowded station reads as "bigger and
 * redder" even before a viewer stops to read numbers.
 */
export function StationMarker({ station, point, scale, selected, waitingCount = 0, onSelect }: StationMarkerProps) {
  const isInterchange = station.stationType === "INTERCHANGE";
  const isTerminal = station.stationType === "TERMINAL";
  const density = densityLevel(waitingCount);
  const haloRadius = { low: 0, moderate: 10, high: 14, crowded: 19 }[density];

  return (
    <g
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      role="button"
      tabIndex={0}
      aria-label={`${station.name} station${waitingCount > 0 ? `, ${waitingCount} waiting` : ""}`}
      className="cursor-pointer outline-none"
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
        <circle r={haloRadius} fill={DENSITY_COLOR[density]} opacity={0.28} />
      )}
      {selected && (
        <circle r={isInterchange ? 12 : 9} fill="none" stroke="#38bdf8" strokeWidth={2} />
      )}
      {isInterchange ? (
        <>
          <circle r={7} fill="#0f172a" stroke="#f1f5f9" strokeWidth={2} />
          <circle r={3} fill="#f1f5f9" />
        </>
      ) : (
        <circle
          r={isTerminal ? 5 : 4}
          fill="#0f172a"
          stroke="#f1f5f9"
          strokeWidth={isTerminal ? 2 : 1.5}
        />
      )}
    </g>
  );
}
