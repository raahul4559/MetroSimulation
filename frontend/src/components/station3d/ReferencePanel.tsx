"use client";

import type { ReferenceConfidence, StationVisualReference } from "@/domain/stationVisualReference";

interface ReferencePanelProps {
  reference: StationVisualReference;
  onClose: () => void;
}

/**
 * The spec's "small developer/admin panel for comparison" (never the main 3D scene itself): shows
 * what real public sources this station's reconstruction is actually based on, their confidence
 * level, and what's explicitly NOT supported by them — so a reviewer can check the 3D
 * reconstruction against the same sources it was built from, without any photograph ever being
 * pasted into the scene itself. `StationScene` only renders this (and its toggle button) once
 * `useStationReferences` has actually resolved a file, so this component never has to represent
 * "no references yet" itself.
 */
export function ReferencePanel({ reference: ref, onClose }: ReferencePanelProps) {
  return (
    <div className="pointer-events-auto w-80 max-h-[70vh] overflow-y-auto rounded-md border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-50">References &amp; Sources</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-100" aria-label="Close references panel">
          ✕
        </button>
      </div>

      <p className="mb-2">
        <span className={confidenceClass(ref.referenceConfidence)}>{confidenceLabel(ref.referenceConfidence)}</span>
        <span className="ml-1.5 text-slate-400">reference confidence</span>
      </p>

      <p className="mb-2 text-[11px] text-slate-400">
        This reconstruction is a research-informed approximation, not a verified physical replica. No photographs are
        stored or displayed here — only links to the public pages consulted.
      </p>

      <section className="mb-3">
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sources</h4>
        <ul className="space-y-1.5">
          {ref.sources.map((source) => (
            <li key={source.url} className="border-l-2 border-slate-700 pl-2">
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">
                {source.title}
              </a>
              <div className="text-[10px] text-slate-500">
                {source.publisher} · retrieved {source.retrievedOn}
              </div>
              <div className="text-[10px] text-slate-500">{source.usageNote}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">What&apos;s supported vs. approximated</h4>
        <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-300">
          {ref.referenceNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function confidenceLabel(confidence: ReferenceConfidence): string {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}

function confidenceClass(confidence: ReferenceConfidence): string {
  switch (confidence) {
    case "high":
      return "rounded bg-emerald-500/20 px-1.5 py-0.5 font-medium text-emerald-300";
    case "medium":
      return "rounded bg-amber-500/20 px-1.5 py-0.5 font-medium text-amber-300";
    case "low":
      return "rounded bg-rose-500/20 px-1.5 py-0.5 font-medium text-rose-300";
  }
}
