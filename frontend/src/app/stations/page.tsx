"use client";

import { useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";
import { useNetwork } from "@/hooks/useNetwork";
import { Panel } from "@/components/ui/Panel";
import { Surface } from "@/components/ui/Surface";
import { Metric } from "@/components/ui/Metric";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Tone } from "@/lib/ui/tone";
import { assessStationAssets, type StationValidationReport } from "@/lib/station3d/validation";

type Entry = StationValidationReport["entries"][number];

const QUALITY_LABEL: Record<Entry["quality"], string> = {
  HIGH: "High fidelity",
  RECONSTRUCTED: "Reconstructed",
  PROCEDURAL: "Procedural",
};

const BUILD_TYPE_LABEL: Record<Entry["config"]["buildType"], string> = {
  ELEVATED: "Elevated",
  UNDERGROUND: "Underground",
  AT_GRADE: "At grade",
};

function qualityTone(quality: Entry["quality"]): Tone {
  if (quality === "HIGH") return "positive";
  if (quality === "RECONSTRUCTED") return "neutral";
  return "warning";
}

function referenceTone(confidence: NonNullable<Entry["referenceConfidence"]>): Tone {
  if (confidence === "high") return "positive";
  if (confidence === "medium") return "neutral";
  return "warning";
}

/**
 * The spec's "Station Assets" dashboard: real counts of every operational station's asset tier
 * (High Fidelity / Reconstructed / Procedural) plus any validation issues, computed live from the
 * current network dataset and whatever `.glb`s actually exist under `public/stations/` — never a
 * hardcoded number, so it stays honest as stations/assets are added.
 *
 * Outside the `(live)` route group on purpose: this is a pipeline audit over static data and has
 * no use for the simulation socket.
 */
export default function StationAssetsPage() {
  const { stations, lines, isLoading, error } = useNetwork();
  const [report, setReport] = useState<StationValidationReport | null>(null);

  useEffect(() => {
    if (isLoading || error || stations.length === 0) return;
    let cancelled = false;
    // Deferred a microtask so this reset is async, not synchronous within the effect body (avoids
    // react-hooks/set-state-in-effect) — same pattern used across this feature's hooks.
    Promise.resolve().then(() => {
      if (!cancelled) setReport(null);
    });
    assessStationAssets(stations, lines).then((result) => {
      if (!cancelled) setReport(result);
    });
    return () => {
      cancelled = true;
    };
  }, [stations, lines, isLoading, error]);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-content">Station assets</h1>
        <p className="mt-1 text-xs text-secondary">
          3D asset pipeline validation, computed from the live network dataset.
        </p>
      </header>

      {error && <p className="text-sm text-danger">{error}</p>}

      {!report && !error && (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      )}

      {report && (
        <>
          <Surface>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Stations" value={report.totalStations} />
              <Metric label="High fidelity" value={report.byQuality.HIGH} tone="positive" />
              <Metric label="Reconstructed" value={report.byQuality.RECONSTRUCTED} />
              <Metric label="Procedural" value={report.byQuality.PROCEDURAL} />
              <Metric
                label="Missing asset"
                value={report.missingAssetCount}
                tone={report.missingAssetCount > 0 ? "warning" : "positive"}
              />
              <Metric
                label="Invalid"
                value={report.invalidStationCount}
                tone={report.invalidStationCount > 0 ? "danger" : "positive"}
              />
            </div>
          </Surface>

          <Panel
            title="Stations"
            description={`${report.withReferencesCount} of ${report.totalStations} have documented visual references.`}
          >
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="border-b border-edge pb-2 pr-3 font-medium">Station</th>
                    <th className="border-b border-edge pb-2 pr-3 font-medium">Build type</th>
                    <th className="border-b border-edge pb-2 pr-3 font-medium">Interchange</th>
                    <th className="border-b border-edge pb-2 pr-3 font-medium">Quality</th>
                    <th className="border-b border-edge pb-2 pr-3 font-medium">model.glb</th>
                    <th className="border-b border-edge pb-2 pr-3 font-medium">environment.glb</th>
                    <th className="border-b border-edge pb-2 pr-3 font-medium">References</th>
                    <th className="border-b border-edge pb-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.map((entry) => (
                    <tr key={entry.stationCode} className="border-b border-divider align-top">
                      <td className="py-2.5 pr-3">
                        <div className="text-content">{entry.stationName}</div>
                        <div className="font-mono text-[10px] text-muted">{entry.stationCode}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-secondary">
                        {BUILD_TYPE_LABEL[entry.config.buildType]}
                      </td>
                      <td className="py-2.5 pr-3 text-secondary">
                        {entry.config.isInterchange ? "Yes" : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge
                          label={QUALITY_LABEL[entry.quality]}
                          tone={qualityTone(entry.quality)}
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <Availability present={entry.modelAvailable} />
                      </td>
                      <td className="py-2.5 pr-3">
                        <Availability present={entry.environmentAvailable} />
                      </td>
                      <td className="py-2.5 pr-3">
                        {entry.referenceConfidence ? (
                          <StatusBadge
                            label={entry.referenceConfidence}
                            tone={referenceTone(entry.referenceConfidence)}
                          />
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {entry.issues.length === 0 ? (
                          <span className="text-positive">None</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {entry.issues.map((issue) => (
                              <li key={issue.code} className="text-warning">
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </main>
  );
}

function Availability({ present }: { present: boolean }) {
  return present ? (
    <span className="inline-flex items-center gap-1 text-positive">
      <Check size={13} aria-hidden />
      <span className="sr-only">Present</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted">
      <Minus size={13} aria-hidden />
      <span className="sr-only">Absent</span>
    </span>
  );
}
