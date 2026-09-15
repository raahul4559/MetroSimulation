import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

interface LoadingOverlayProps {
  /** Small caps wordmark above the title. */
  eyebrow?: string;
  title: string;
  /** What is happening right now — expected to change as the load progresses. */
  message: string;
  /** 0..1. Determinate by design: an indeterminate spinner tells the operator nothing. */
  progress: number;
  /** Context line under the bar, e.g. "Majestic • 3D Environment". */
  context?: ReactNode;
  /** Background colour to sit on. Seeding this from the destination scene is what makes the
   * hand-off read as a dissolve rather than a cut. */
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The full-bleed loading state.
 *
 * Deliberately not a spinner over a blank canvas: the operator is waiting on something with a
 * known shape (locate → resolve environment → build architecture → enter), so the bar is
 * determinate and the caption names the stage.
 */
export function LoadingOverlay({
  eyebrow = "Namma Metro",
  title,
  message,
  progress,
  context,
  backgroundColor,
  className,
  style,
}: LoadingOverlayProps) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      className={cn("absolute inset-0 flex flex-col items-center justify-center px-6", className)}
      style={{ backgroundColor, ...style }}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">{eyebrow}</p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content">{title}</h2>
        <p className="mt-2 text-sm text-secondary">{message}</p>

        <div
          className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={message}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-(--ease-out)"
            style={{ width: `${pct}%` }}
          />
        </div>

        {context && (
          <p className="tabular mt-3 text-[11px] uppercase tracking-wider text-muted">{context}</p>
        )}
      </div>
    </div>
  );
}
