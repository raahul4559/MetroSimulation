import { Surface } from "@/components/ui/Surface";
import { Metric } from "@/components/ui/Metric";
import type { Tone } from "@/lib/ui/tone";

interface StatTileProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: Tone;
}

/** A Metric in its own tile — the analytics grid's unit. All the presentation lives in `Metric`;
 * this is purely the composition that gives it an edge and a background, so the dashboard grid
 * and the inline metric rows elsewhere can never drift apart. */
export function StatTile({ label, value, sublabel, tone = "neutral" }: StatTileProps) {
  return (
    <Surface variant="sunken" padding="sm">
      <Metric
        label={label}
        value={value}
        tone={tone}
        size="lg"
        {...(sublabel !== undefined ? { sublabel } : {})}
      />
    </Surface>
  );
}
