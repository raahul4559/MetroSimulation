"use client";

import { cn } from "@/lib/ui/cn";

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

/** A labelled switch row, as used in the settings menu. A real checkbox underneath, visually
 * restyled — so it keeps native keyboard behaviour and announces correctly. */
export function ToggleRow({ label, checked, onChange, disabled = false, hint }: ToggleRowProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-1.5",
        "transition-colors hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs text-content">{label}</span>
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-0 opacity-0"
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none h-4 w-7 rounded-full transition-colors duration-(--duration-fast)",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
            checked ? "bg-accent" : "bg-white/15",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 size-3 rounded-full bg-white transition-[left] duration-(--duration-fast) ease-(--ease-out)",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </label>
  );
}
