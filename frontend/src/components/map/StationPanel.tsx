import type { ReactNode } from "react";
import type { Line, Station, Track } from "@/domain/metro";
import type { Passenger, TrainState } from "@/domain/trainsim";
import type { ConnectionStatus } from "@/lib/ws/simulation-socket";
import { buildStationIndex, getLinesForStation, getNeighborStations } from "@/lib/metro/selectors";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OccupancyBar } from "@/components/ui/OccupancyBar";
import {
  DENSITY_LABEL,
  DENSITY_TONE,
  densityLevel,
  getStationQueue,
} from "@/lib/metro/passengerDisplay";

interface StationPanelProps {
  station: Station;
  lines: readonly Line[];
  stations: readonly Station[];
  tracks: readonly Track[];
  trains: readonly TrainState[];
  passengers: readonly Passenger[];
  liveFeedStatus: ConnectionStatus;
  onClose: () => void;
}

const AT_STATION_STATUSES = new Set(["AT_STATION", "DWELLING"]);

const TYPE_LABEL: Record<Station["stationType"], string> = {
  REGULAR: "Regular station",
  INTERCHANGE: "Interchange",
  TERMINAL: "Terminus",
};

/**
 * Station information panel, opened by clicking a station on the map. Reads only from props —
 * all derivation (lines, neighbors) comes from `lib/metro/selectors`, not computed here.
 */
export function StationPanel({
  station,
  lines,
  stations,
  tracks,
  trains,
  passengers,
  liveFeedStatus,
  onClose,
}: StationPanelProps) {
  const stationLines = getLinesForStation(station, lines);
  const neighbors = getNeighborStations(station, tracks, buildStationIndex(stations));
  const lineByCode = new Map(lines.map((line) => [line.code, line]));

  const trainsHere = trains.filter(
    (t) => t.previousStationId === station.id && AT_STATION_STATUSES.has(t.status)
  );
  const queue = getStationQueue(passengers, station.id);
  const density = densityLevel(queue.length);

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-2 top-auto max-h-[65%] w-auto overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur md:inset-auto md:top-16 md:right-3 md:bottom-3 md:w-80 md:max-h-none">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-50">{station.name}</h3>
          <p className="text-xs text-slate-500">{station.code}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close station panel"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <StatusBadge
          label={TYPE_LABEL[station.stationType]}
          tone={station.stationType === "INTERCHANGE" ? "warning" : "neutral"}
        />
        <StatusBadge label="Operational" tone="positive" />
      </div>

      <Section title="Lines">
        <div className="flex flex-wrap gap-1.5">
          {stationLines.map((line) => (
            <span
              key={line.id}
              className="flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: line.colorHex }}
                aria-hidden
              />
              {line.name}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Nearby stations">
        {neighbors.length === 0 ? (
          <p className="text-xs text-slate-500">No connected stations.</p>
        ) : (
          <ul className="space-y-1.5">
            {neighbors.map((neighbor) => (
              <li
                key={`${neighbor.station.id}-${neighbor.lineCode}`}
                className="flex items-center justify-between text-xs text-slate-300"
              >
                <span>{neighbor.station.name}</span>
                <span className="text-slate-500">
                  {(neighbor.distanceMetres / 1000).toFixed(1)} km ·{" "}
                  {Math.round(neighbor.travelTimeSeconds / 60)} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Current trains">
        {trainsHere.length === 0 ? (
          <p className="text-xs text-slate-500">No trains currently at this station.</p>
        ) : (
          <ul className="space-y-2">
            {trainsHere.map((train) => (
              <li key={train.id} className="text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: lineByCode.get(train.lineCode)?.colorHex ?? "#94a3b8" }}
                      aria-hidden
                    />
                    <span className="font-mono font-medium text-slate-100">{train.code}</span>
                  </span>
                  <span className="text-slate-500">{train.status === "DWELLING" ? "Boarding" : "At platform"}</span>
                </div>
                <OccupancyBar count={train.passengerCount} capacity={train.capacity} compact />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Passenger queue">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-slate-300">{queue.length} waiting</span>
          <StatusBadge label={DENSITY_LABEL[density]} tone={DENSITY_TONE[density]} />
        </div>
        {queue.length > 0 && (
          <p className="text-xs text-slate-500">
            {queue.filter((p) => p.status === "TRANSFER").length} transferring ·{" "}
            {queue.filter((p) => p.status === "WAITING").length} first boarding
          </p>
        )}
      </Section>

      <Section title="Data feed" last>
        <p className="text-xs text-slate-400">
          {liveFeedStatus === "connected"
            ? "Connected — receiving live simulation updates."
            : liveFeedStatus === "connecting"
              ? "Connecting to the simulation feed…"
              : "Disconnected from the simulation feed."}
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children, last = false }: { title: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-4"}>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {children}
    </div>
  );
}
