import type { Interchange, Station } from "@/domain/metro";

interface StationDetailPanelProps {
  stations: readonly Station[];
  interchanges: readonly Interchange[];
}

export function StationDetailPanel({ stations, interchanges }: StationDetailPanelProps) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-slate-500">Stations</dt>
          <dd className="text-slate-100">{stations.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Interchanges</dt>
          <dd className="text-slate-100">{interchanges.length}</dd>
        </div>
      </dl>
      {interchanges.length > 0 && (
        <ul className="space-y-1">
          {interchanges.map(({ station, connectedLines }) => (
            <li key={station.id} className="text-xs text-slate-400">
              <span className="text-slate-200">{station.name}</span>{" "}
              ({connectedLines.map((line) => line.code).join(" ↔ ")})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
