import type { Station } from "@/domain/metro";
import type { Projector } from "@/lib/geometry/projection";

export function StationMarker({ station, project }: { station: Station; project: Projector }) {
  const { x, y } = project(station);
  const isInterchange = station.stationType === "INTERCHANGE";

  return (
    <g>
      {isInterchange ? (
        <>
          <circle cx={x} cy={y} r={7} fill="#0f172a" stroke="#f1f5f9" strokeWidth={2} />
          <circle cx={x} cy={y} r={3} fill="#f1f5f9" />
        </>
      ) : (
        <circle cx={x} cy={y} r={4} fill="#0f172a" stroke="#f1f5f9" strokeWidth={1.5} />
      )}
      <text
        x={x}
        y={y - 10}
        textAnchor="middle"
        fontSize={9}
        fill="#cbd5e1"
        className="select-none"
      >
        {station.name}
      </text>
    </g>
  );
}
