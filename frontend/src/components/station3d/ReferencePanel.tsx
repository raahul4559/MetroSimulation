"use client";

import { ExternalLink, X } from "lucide-react";
import type { ReferenceConfidence, StationVisualReference } from "@/domain/stationVisualReference";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IconButton } from "@/components/ui/IconButton";
import type { Tone } from "@/lib/ui/tone";

interface ReferencePanelProps {
  reference: StationVisualReference;
  onClose: () => void;
}

const CONFIDENCE_LABEL: Record<ReferenceConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const CONFIDENCE_TONE: Record<ReferenceConfidence, Tone> = {
  high: "positive",
  medium: "warning",
  low: "danger",
};

/**
 * The spec's "small developer/admin panel for comparison" (never the main 3D scene itself): shows
 * what real public sources this station's reconstruction is actually based on, their confidence
 * level, and what's explicitly NOT supported by them — so a reviewer can check the 3D
 * reconstruction against the same sources it was built from, without any photograph ever being
 * pasted into the scene itself. `Station3DOverlay` only renders this (and its toggle button) once
 * `useStationReferences` has actually resolved a file, so this component never has to represent
 * "no references yet" itself.
 */
export function ReferencePanel({ reference: ref, onClose }: ReferencePanelProps) {
  return (
    <div className="scroll-thin pointer-events-auto max-h-[70vh] w-80 overflow-y-auto rounded-lg bg-surface/95 p-3.5 text-xs shadow-lg ring-1 ring-edge backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-content">References &amp; sources</h3>
        <IconButton
          label="Close references panel"
          icon={<X size={14} />}
          size="sm"
          onClick={onClose}
          tooltipSide="left"
        />
      </div>

      <StatusBadge
        label={CONFIDENCE_LABEL[ref.referenceConfidence]}
        tone={CONFIDENCE_TONE[ref.referenceConfidence]}
      />

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        This reconstruction is a research-informed approximation, not a verified physical replica.
        No photographs are stored or displayed here — only links to the public pages consulted.
      </p>

      <section className="mt-4">
        <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">Sources</h4>
        <ul className="space-y-2.5">
          {ref.sources.map((source) => (
            <li key={source.url} className="border-l-2 border-edge pl-2.5">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {source.title}
                <ExternalLink size={11} aria-hidden className="shrink-0" />
              </a>
              <div className="mt-0.5 text-[10px] text-muted">
                {source.publisher} · retrieved {source.retrievedOn}
              </div>
              <div className="text-[10px] text-muted">{source.usageNote}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4">
        <h4 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
          Supported vs. approximated
        </h4>
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-secondary">
          {ref.referenceNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
