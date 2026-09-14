import { useState } from "react";
import type { Station } from "@/domain/metro";
import type { CreateDisruptionRequest, DisruptionSeverity, DisruptionType, TrainState } from "@/domain/trainsim";
import { resourceTypeFor } from "@/domain/trainsim";
import { DISRUPTION_TYPE_LABEL } from "@/lib/metro/disruptionDisplay";

interface DisruptionPanelProps {
  stations: readonly Station[];
  trains: readonly TrainState[];
  onCreate: (request: CreateDisruptionRequest) => void;
  isBusy: boolean;
  error: string | null;
}

const DISRUPTION_TYPES: readonly DisruptionType[] = [
  "TRACK_BLOCKAGE",
  "SIGNAL_FAILURE",
  "STATION_CONGESTION",
  "TRAIN_FAILURE",
  "EXTENDED_DWELL",
  "CUSTOM_DELAY",
];

const SEVERITIES: readonly DisruptionSeverity[] = ["MINOR", "MODERATE", "MAJOR", "SEVERE"];

/** Create-disruption form. Example: "Block track between Station A and Station B for 10 minutes"
 * maps to type=TRACK_BLOCKAGE, fromStationId=A, toStationId=B, durationSeconds=600. The resource
 * picker shown depends on the selected type's fixed resource kind (see `resourceTypeFor`). */
export function DisruptionPanel({ stations, trains, onCreate, isBusy, error }: DisruptionPanelProps) {
  const [type, setType] = useState<DisruptionType>("TRACK_BLOCKAGE");
  const [fromStationId, setFromStationId] = useState<number | "">("");
  const [toStationId, setToStationId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");
  const [trainId, setTrainId] = useState<number | "">("");
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [severity, setSeverity] = useState<DisruptionSeverity>("MODERATE");
  const [description, setDescription] = useState("");

  const resourceType = resourceTypeFor(type);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const durationSeconds = Math.max(1, Math.round(durationMinutes * 60));
    const trimmedDescription = description.trim();
    const base = {
      type,
      durationSeconds,
      severity,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
    };

    if (resourceType === "TRACK") {
      if (fromStationId === "" || toStationId === "") return;
      onCreate({ ...base, fromStationId, toStationId });
    } else if (resourceType === "STATION") {
      if (stationId === "") return;
      onCreate({ ...base, resourceId: stationId });
    } else {
      if (trainId === "") return;
      onCreate({ ...base, resourceId: trainId });
    }
  }

  const selectClass =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100";
  const labelClass = "block text-xs text-slate-400";

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div>
        <label className={labelClass}>Type</label>
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as DisruptionType)}>
          {DISRUPTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {DISRUPTION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {resourceType === "TRACK" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>From station</label>
            <select
              className={selectClass}
              value={fromStationId}
              onChange={(e) => setFromStationId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select…</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>To station</label>
            <select
              className={selectClass}
              value={toStationId}
              onChange={(e) => setToStationId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select…</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {resourceType === "STATION" && (
        <div>
          <label className={labelClass}>Station</label>
          <select
            className={selectClass}
            value={stationId}
            onChange={(e) => setStationId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Select…</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {resourceType === "TRAIN" && (
        <div>
          <label className={labelClass}>Train</label>
          <select
            className={selectClass}
            value={trainId}
            onChange={(e) => setTrainId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Select…</option>
            {trains
              .filter((t) => t.status !== "SCHEDULED" && t.status !== "COMPLETED")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Duration (minutes)</label>
          <input
            type="number"
            min={1}
            className={selectClass}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={labelClass}>Severity</label>
          <select className={selectClass} value={severity} onChange={(e) => setSeverity(e.target.value as DisruptionSeverity)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Description (optional)</label>
        <input
          type="text"
          className={selectClass}
          placeholder={DISRUPTION_TYPE_LABEL[type]}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={isBusy}
        className="w-full rounded-md bg-red-900/70 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-900 disabled:opacity-50"
      >
        {isBusy ? "Creating…" : "Create disruption"}
      </button>
    </form>
  );
}
