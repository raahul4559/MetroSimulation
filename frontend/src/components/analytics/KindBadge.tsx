import type { AnalyticsKind } from "@/domain/trainsim/analytics";
import { cn } from "@/lib/ui/cn";

const KIND_LABEL: Record<AnalyticsKind, string> = {
  LIVE: "Live",
  SIMULATION_RESULT: "Simulation result",
  HISTORICAL: "Historical",
};

/** Provenance is its own axis — it is not a status, so it deliberately does not borrow the
 * positive/warning/danger tones. Live is green only because it means "streaming right now". */
const KIND_CLASSES: Record<AnalyticsKind, string> = {
  LIVE: "bg-positive/10 text-positive ring-positive/25",
  SIMULATION_RESULT: "bg-accent/10 text-accent ring-accent/25",
  HISTORICAL: "bg-white/5 text-secondary ring-edge",
};

/** The dashboard's LIVE / SIMULATION RESULT / HISTORICAL distinction, read straight off each
 * section's own `kind` field rather than hardcoded per place this badge is used — see
 * `AnalyticsResponse`'s javadoc for what each of the three actually means. */
export function KindBadge({ kind }: { kind: AnalyticsKind }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset whitespace-nowrap",
        KIND_CLASSES[kind],
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
