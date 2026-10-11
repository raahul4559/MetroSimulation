import type { DataState } from "@/lib/realtime/dataState";
import { TONE_CLASSES } from "@/lib/ui/tone";
import { cn } from "@/lib/ui/cn";

interface DataStateBadgeProps {
  /** Null outside the live provider — renders nothing, never a placeholder "live". */
  state: DataState | null;
  /**
   * `stacked` — the word, then the caption on its own line (cards, the 3D station).
   * `inline`  — word and caption on one line (headers, the status bar).
   * `compact` — the word only, caption in the tooltip (panel headers, dense rows).
   */
  layout?: "stacked" | "inline" | "compact";
  className?: string;
}

/**
 * The data-state badge every realtime-dependent component carries:
 *
 *   ● LIVE
 *   Updated 6s ago
 *
 * Its content comes only from `describeDataState`/`describeTrainDataState` — this component never
 * decides what is live. The dot is steady; only CONNECTING pulses, because it is genuinely pending.
 */
export function DataStateBadge({ state, layout = "stacked", className }: DataStateBadgeProps) {
  if (!state) return null;
  const tone = TONE_CLASSES[state.tone];
  const word = (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold tracking-[0.08em]", tone.text)}>
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", tone.dot)}
        style={state.kind === "CONNECTING" ? { animation: "pulse-dot 1.6s var(--ease-in-out) infinite" } : undefined}
      />
      {state.label}
    </span>
  );

  return (
    <span
      // No live region: the caption ticks every second and would be read out continuously.
      title={layout === "compact" ? `${state.caption}. ${state.detail}` : state.detail}
      className={cn(
        "text-[11px] leading-tight",
        layout === "stacked" ? "inline-flex flex-col gap-0.5" : "inline-flex items-center gap-2 whitespace-nowrap",
        className,
      )}
    >
      {word}
      {layout === "compact" ? (
        <span className="sr-only">{state.caption}</span>
      ) : (
        <span className={cn("tabular text-muted", layout === "stacked" && "pl-3")}>{state.caption}</span>
      )}
    </span>
  );
}
