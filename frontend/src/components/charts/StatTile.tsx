type Tone = "neutral" | "good" | "warning" | "critical";

const TONE_VALUE_CLASSES: Record<Tone, string> = {
  neutral: "text-slate-100",
  good: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: Tone;
}

/** The figure contract from the dataviz skill: label (sentence case, no trailing colon), a large
 * semibold value in the default proportional figures (never `tabular-nums` — that's for columns),
 * an optional sublabel. */
export function StatTile({ label, value, sublabel, tone = "neutral" }: StatTileProps) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${TONE_VALUE_CLASSES[tone]}`}>{value}</div>
      {sublabel && <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}
