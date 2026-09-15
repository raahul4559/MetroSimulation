import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES, type Tone } from "@/lib/ui/tone";

type MetricSize = "sm" | "md" | "lg";

interface MetricProps {
  label: string;
  value: string | number;
  /** Rendered smaller and muted right after the value — "s", "km/h", "%". */
  unit?: string;
  sublabel?: string;
  tone?: Tone;
  size?: MetricSize;
  className?: string;
}

const VALUE_SIZE: Record<MetricSize, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

/**
 * One labelled number.
 *
 * This replaces four separate implementations of the same idea (charts/StatTile, the local
 * SummaryTile on /stations, PassengerMetricsPanel's Stat, and DelayAnalyticsPanel's inline
 * tiles) — which between them used two incompatible tone vocabularies and three type scales.
 *
 * `tabular` is not optional: these values update every simulation tick, and proportional digits
 * make the whole row twitch as the glyph widths change.
 */
export function Metric({
  label,
  value,
  unit,
  sublabel,
  tone = "neutral",
  size = "md",
  className,
}: MetricProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div
        className={cn(
          "tabular mt-1 flex items-baseline gap-1 font-semibold",
          VALUE_SIZE[size],
          tone === "neutral" ? "text-content" : TONE_CLASSES[tone].text,
        )}
      >
        <span className="truncate">{value}</span>
        {unit && <span className="text-xs font-normal text-muted">{unit}</span>}
      </div>
      {sublabel && <div className="mt-0.5 truncate text-xs text-muted">{sublabel}</div>}
    </div>
  );
}
