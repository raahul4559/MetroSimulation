"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useNetwork } from "@/hooks/useNetwork";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { assessStationAssets, type StationValidationReport } from "@/lib/station3d/validation";

/**
 * The spec's "Station Assets" dashboard: real counts of every operational station's asset tier
 * (High Fidelity / Reconstructed / Procedural) plus any validation issues, computed live from the
 * current network dataset and whatever `.glb`s actually exist under `public/stations/` — never a
 * hardcoded number, so it stays honest as stations/assets are added.
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
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Station Assets</h1>
          <p className="text-xs text-slate-500">3D asset pipeline validation, computed from the live network dataset</p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-200 shadow hover:bg-slate-800"
        >
          ← Network
        </Link>
      </header>

      {isLoading && <p className="text-sm text-slate-500">Loading network…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!report && !isLoading && !error && <p className="text-sm text-slate-500">Assessing station assets…</p>}

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryTile label="Stations" value={report.totalStations} />
            <SummaryTile label="High Fidelity" value={report.byQuality.HIGH} tone="positive" />
            <SummaryTile label="Reconstructed" value={report.byQuality.RECONSTRUCTED} tone="neutral" />
            <SummaryTile label="Procedural" value={report.byQuality.PROCEDURAL} tone="neutral" />
            <SummaryTile
              label="Missing high-fidelity asset"
              value={report.missingAssetCount}
              tone={report.missingAssetCount > 0 ? "warning" : "positive"}
            />
            <SummaryTile
              label="Invalid stations"
              value={report.invalidStationCount}
              tone={report.invalidStationCount > 0 ? "danger" : "positive"}
            />
            <SummaryTile label="With visual references" value={report.withReferencesCount} tone="neutral" />
          </div>

          <Panel title="Stations">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Station</th>
                    <th className="py-2 pr-3 font-medium">Build type</th>
                    <th className="py-2 pr-3 font-medium">Interchange</th>
                    <th className="py-2 pr-3 font-medium">Quality</th>
                    <th className="py-2 pr-3 font-medium">model.glb</th>
                    <th className="py-2 pr-3 font-medium">environment.glb</th>
                    <th className="py-2 pr-3 font-medium">References</th>
                    <th className="py-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.map((entry) => (
                    <tr key={entry.stationCode} className="border-b border-slate-900">
                      <td className="py-2 pr-3">
                        <div className="text-slate-100">{entry.stationName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{entry.stationCode}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{entry.config.buildType}</td>
                      <td className="py-2 pr-3 text-slate-300">{entry.config.isInterchange ? "Yes" : "—"}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge label={entry.quality} tone={qualityTone(entry.quality)} />
                      </td>
                      <td className="py-2 pr-3 text-slate-300">{entry.modelAvailable ? "✓" : "—"}</td>
                      <td className="py-2 pr-3 text-slate-300">{entry.environmentAvailable ? "✓" : "—"}</td>
                      <td className="py-2 pr-3">
                        {entry.referenceConfidence ? (
                          <StatusBadge label={entry.referenceConfidence} tone={referenceTone(entry.referenceConfidence)} />
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-300">
                        {entry.issues.length === 0 ? (
                          <span className="text-emerald-400">None</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {entry.issues.map((issue) => (
                              <li key={issue.code} className="text-amber-400">
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
        </div>
      )}
    </div>
  );
}

function qualityTone(quality: StationValidationReport["entries"][number]["quality"]): "positive" | "neutral" | "warning" {
  if (quality === "HIGH") return "positive";
  if (quality === "RECONSTRUCTED") return "neutral";
  return "warning";
}

function referenceTone(confidence: NonNullable<StationValidationReport["entries"][number]["referenceConfidence"]>): "positive" | "neutral" | "warning" {
  if (confidence === "high") return "positive";
  if (confidence === "medium") return "neutral";
  return "warning";
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "positive" | "neutral" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-red-400"
          : "text-slate-100";
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
