import type { Line, Station } from "@/domain/metro";
import type { StationConfig, StationModelQuality } from "@/domain/stationConfig";
import type { ReferenceConfidence } from "@/domain/stationVisualReference";
import { getStationConfig } from "@/config/stations/stationConfigs";
import { checkAssetExists } from "./assetAvailability";

export interface StationValidationIssue {
  readonly code: string;
  readonly message: string;
}

export interface StationValidationEntry {
  readonly stationCode: string;
  readonly stationName: string;
  readonly config: StationConfig;
  readonly quality: StationModelQuality;
  readonly modelAvailable: boolean;
  readonly environmentAvailable: boolean;
  /** `null` when this station has no `references.json` yet — distinct from a low-confidence entry
   * that does exist, so the dashboard can tell "not researched" apart from "researched, sparse." */
  readonly referenceConfidence: ReferenceConfidence | null;
  readonly issues: readonly StationValidationIssue[];
}

export interface StationValidationReport {
  readonly totalStations: number;
  readonly byQuality: Readonly<Record<StationModelQuality, number>>;
  readonly invalidStationCount: number;
  readonly missingAssetCount: number;
  readonly withReferencesCount: number;
  readonly entries: readonly StationValidationEntry[];
}

/**
 * The spec's validation tool: audits every operational station's config + real, network-wide
 * `.glb` availability, and returns exact counts computed from the actual project data — never a
 * hardcoded dashboard number. Re-running this after adding a station, curating its config, or
 * dropping in a real asset always reflects that change immediately, because nothing here is
 * cached beyond the single report it builds.
 */
export async function assessStationAssets(
  stations: readonly Station[],
  lines: readonly Line[]
): Promise<StationValidationReport> {
  const entries = await Promise.all(stations.map((station) => assessStation(station, lines)));

  const byQuality: Record<StationModelQuality, number> = { HIGH: 0, RECONSTRUCTED: 0, PROCEDURAL: 0 };
  let invalidStationCount = 0;
  let missingAssetCount = 0;
  let withReferencesCount = 0;
  for (const entry of entries) {
    byQuality[entry.quality] += 1;
    if (entry.issues.length > 0) invalidStationCount += 1;
    if (!entry.modelAvailable) missingAssetCount += 1;
    if (entry.referenceConfidence != null) withReferencesCount += 1;
  }

  return {
    totalStations: stations.length,
    byQuality,
    invalidStationCount,
    missingAssetCount,
    withReferencesCount,
    entries,
  };
}

async function assessStation(station: Station, lines: readonly Line[]): Promise<StationValidationEntry> {
  const config = getStationConfig(station, lines);
  const [modelAvailable, environmentAvailable, referenceConfidence] = await Promise.all([
    checkAssetExists(config.modelPath),
    checkAssetExists(config.environmentPath),
    fetchReferenceConfidence(config.id),
  ]);
  const quality: StationModelQuality = modelAvailable ? "HIGH" : config.synthesized ? "PROCEDURAL" : "RECONSTRUCTED";

  return {
    stationCode: station.code,
    stationName: station.name,
    config,
    quality,
    modelAvailable,
    environmentAvailable,
    referenceConfidence,
    issues: validateStationEntry(station, lines, config, modelAvailable, environmentAvailable),
  };
}

/** Reads just the `referenceConfidence` field out of `public/stations/<id>/references.json`, if
 * it exists — a real `GET` rather than `checkAssetExists`'s `HEAD`, since the dashboard needs the
 * file's content, not just its presence. `null` on any failure (missing file, bad JSON, wrong
 * shape) so a broken references file degrades to "not researched," never a page-wide error. */
async function fetchReferenceConfidence(stationId: string): Promise<ReferenceConfidence | null> {
  try {
    const res = await fetch(`/stations/${stationId}/references.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as { referenceConfidence?: unknown };
    return data.referenceConfidence === "high" || data.referenceConfidence === "medium" || data.referenceConfidence === "low"
      ? data.referenceConfidence
      : null;
  } catch {
    return null;
  }
}

function validateStationEntry(
  station: Station,
  lines: readonly Line[],
  config: StationConfig,
  modelAvailable: boolean,
  environmentAvailable: boolean
): StationValidationIssue[] {
  const issues: StationValidationIssue[] = [];

  const hasValidCoordinates =
    Number.isFinite(station.latitude) &&
    Number.isFinite(station.longitude) &&
    !(station.latitude === 0 && station.longitude === 0);
  if (!hasValidCoordinates) {
    issues.push({ code: "MISSING_COORDINATES", message: "Station has no valid latitude/longitude." });
  }

  const knownLineCodes = new Set(lines.map((l) => l.code));
  const invalidLines = station.lines.filter((code) => !knownLineCodes.has(code));
  if (invalidLines.length > 0) {
    issues.push({ code: "INVALID_LINE_REFERENCE", message: `References unknown line(s): ${invalidLines.join(", ")}.` });
  }

  const servingLineCount = station.lines.length;
  if (servingLineCount === 0) {
    issues.push({ code: "NO_LINES", message: "Station is not served by any line." });
  }
  if (config.isInterchange && servingLineCount < 2) {
    issues.push({
      code: "INTERCHANGE_FLAG_MISMATCH",
      message: "Configured as an interchange but fewer than two lines actually serve it.",
    });
  }
  if (!config.isInterchange && servingLineCount > 1) {
    issues.push({
      code: "INTERCHANGE_FLAG_MISMATCH",
      message: "Serves multiple lines but isn't configured as an interchange.",
    });
  }

  if (!Number.isFinite(station.dwellTimeSeconds) || station.dwellTimeSeconds <= 0) {
    issues.push({ code: "INVALID_DWELL_TIME", message: "Dwell time must be a positive number of seconds." });
  }

  if (modelAvailable !== environmentAvailable) {
    issues.push({
      code: "INCOMPLETE_ASSET_SET",
      message: modelAvailable
        ? "model.glb is present but environment.glb is missing."
        : "environment.glb is present but model.glb is missing.",
    });
  }

  return issues;
}
