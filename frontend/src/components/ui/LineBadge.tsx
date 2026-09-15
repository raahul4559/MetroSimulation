import { cn } from "@/lib/ui/cn";
import { lineColor, lineVividColor } from "@/lib/ui/lineColor";

interface LineLike {
  readonly code: string;
  readonly name: string;
  readonly colorHex: string;
}

interface LineBadgeProps {
  line: LineLike | null | undefined;
  /**
   * `dot`  — swatch only, for dense rows where the name is already nearby.
   * `pill` — swatch + name, the default identity chip.
   * `bar`  — a short vertical rule, for leading a card or list item.
   */
  variant?: "dot" | "pill" | "bar";
  /** Overrides the label (e.g. a direction: "Purple → Whitefield"). */
  label?: string;
  dimmed?: boolean;
  className?: string;
}

/**
 * The only place a metro line's colour reaches the DOM.
 *
 * Line colour is backend data, so it can only ever arrive as an inline style — which previously
 * meant eight hand-written `style={{ backgroundColor: line.colorHex }}` spans, each with its own
 * size, its own fallback, and its own opinion about whether to also show the name. Routing all of
 * them through here is also what makes the brand/vivid distinction enforceable: swatches get the
 * true brand hex, text gets the lifted one so it survives on a near-black surface.
 */
export function LineBadge({
  line,
  variant = "pill",
  label,
  dimmed = false,
  className,
}: LineBadgeProps) {
  const swatch = lineColor(line);
  const text = lineVividColor(line);
  const name = label ?? line?.name ?? "Unknown line";

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-block size-2 shrink-0 rounded-full", className)}
        style={{ backgroundColor: swatch, opacity: dimmed ? 0.35 : 1 }}
        role="img"
        aria-label={name}
      />
    );
  }

  if (variant === "bar") {
    return (
      <span
        className={cn("inline-block w-0.5 shrink-0 self-stretch rounded-full", className)}
        style={{ backgroundColor: swatch, opacity: dimmed ? 0.35 : 1 }}
        role="img"
        aria-label={name}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1.5 pr-2.5 text-[11px] font-medium whitespace-nowrap",
        "bg-white/5 ring-1 ring-inset ring-edge",
        dimmed && "opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: swatch }}
      />
      <span style={{ color: text }}>{name}</span>
    </span>
  );
}
