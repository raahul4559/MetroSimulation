type Tone = "neutral" | "positive" | "warning" | "danger";

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-700 text-slate-200",
  positive: "bg-emerald-900 text-emerald-300",
  warning: "bg-amber-900 text-amber-300",
  danger: "bg-red-900 text-red-300",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
