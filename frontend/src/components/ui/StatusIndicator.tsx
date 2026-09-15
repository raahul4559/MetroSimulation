import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES, type Tone } from "@/lib/ui/tone";

interface StatusIndicatorProps {
  label: string;
  tone?: Tone;
  /** Slow opacity pulse, for genuinely pending states only — never for steady-state "it's fine". */
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Dot + label. The default way to express state in this interface; StatusBadge is the exception,
 * reserved for when the state needs to survive being scanned in a dense table.
 */
export function StatusIndicator({
  label,
  tone = "neutral",
  pulse = false,
  size = "sm",
  className,
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap",
        size === "sm" ? "text-xs" : "text-sm",
        tone === "neutral" ? "text-secondary" : TONE_CLASSES[tone].text,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", TONE_CLASSES[tone].dot)}
        style={pulse ? { animation: "pulse-dot 1.6s var(--ease-in-out) infinite" } : undefined}
      />
      {label}
    </span>
  );
}
