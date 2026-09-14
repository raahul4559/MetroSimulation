import type { Station } from "@/domain/metro";
import type { Point } from "@/lib/geometry/projection";

interface StationMarkerProps {
  station: Station;
  point: Point;
  scale: number;
  selected: boolean;
  onSelect: (station: Station) => void;
}

/**
 * A station node. Wrapped in its own `translate → scale(1/zoom)` group so the marker stays a
 * constant on-screen size at any map zoom level, independent of the shared pan/zoom transform
 * applied to the map as a whole.
 */
export function StationMarker({ station, point, scale, selected, onSelect }: StationMarkerProps) {
  const isInterchange = station.stationType === "INTERCHANGE";
  const isTerminal = station.stationType === "TERMINAL";

  return (
    <g
      transform={`translate(${point.x} ${point.y}) scale(${1 / scale})`}
      role="button"
      tabIndex={0}
      aria-label={`${station.name} station`}
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
