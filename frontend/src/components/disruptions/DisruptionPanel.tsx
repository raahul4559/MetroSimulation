"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Station } from "@/domain/metro";
import type {
  CreateDisruptionRequest,
  DisruptionSeverity,
  DisruptionType,
  TrainState,
} from "@/domain/trainsim";
import { resourceTypeFor } from "@/domain/trainsim";
import {
  DISRUPTION_SEVERITY_LABEL,
  DISRUPTION_TYPE_LABEL,
} from "@/lib/metro/disruptionDisplay";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

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

  const stationOptions = stations.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ));

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger/10 px-2.5 py-2 text-[11px] text-danger ring-1 ring-inset ring-danger/25">
          <TriangleAlert size={13} className="mt-px shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value as DisruptionType)}>
          {DISRUPTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {DISRUPTION_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>

      {resourceType === "TRACK" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="From station">
            <Select
              value={fromStationId}
              onChange={(e) => setFromStationId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select…</option>
              {stationOptions}
            </Select>
          </Field>
          <Field label="To station">
            <Select
              value={toStationId}
              onChange={(e) => setToStationId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select…</option>
              {stationOptions}
            </Select>
          </Field>
        </div>
      )}

      {resourceType === "STATION" && (
        <Field label="Station">
          <Select
            value={stationId}
            onChange={(e) => setStationId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Select…</option>
            {stationOptions}
          </Select>
        </Field>
      )}

      {resourceType === "TRAIN" && (
        <Field label="Train">
          <Select
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
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Duration" hint="minutes">
          <Input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
        </Field>
        <Field label="Severity">
          <Select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as DisruptionSeverity)}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {DISRUPTION_SEVERITY_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description" hint="Optional">
        <Input
          type="text"
          placeholder={DISRUPTION_TYPE_LABEL[type]}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Button
        type="submit"
        variant="danger"
        size="sm"
        fullWidth
        loading={isBusy}
        icon={<TriangleAlert size={13} />}
      >
        {isBusy ? "Creating…" : "Create disruption"}
      </Button>
    </form>
  );
}
