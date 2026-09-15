import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES, type Tone } from "@/lib/ui/tone";

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
}

/**
 * A small state chip. Outlined and tinted rather than filled: a dashboard showing twenty trains
 * would otherwise be twenty saturated blocks competing with the line colours, which are the only
 * thing on screen that should be loud.
 */
export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE_CLASSES[tone].chip,
        className,
      )}
    >
      {label}
    </span>
  );
}
