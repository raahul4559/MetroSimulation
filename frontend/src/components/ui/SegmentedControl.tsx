"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/ui/cn";

export interface SegmentOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
  /** Announced to assistive tech when the visible label is an abbreviation ("10×"). */
  readonly srLabel?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  /** Required: the control has no visible heading of its own. */
  ariaLabel: string;
  className?: string;
}

/**
 * A single-choice control rendered as a row of segments.
 *
 * Exists because the identical pattern was hand-rolled three times — simulation speed, analytics
 * time range, and the 3D camera modes — each with slightly different padding and none of them
 * keyboard-navigable. Implemented as a radiogroup with a roving tabindex, so the whole group is
 * one tab stop and the arrow keys move between options, which is what a keyboard user expects.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = options.findIndex((o) => o.value === value);
    const next = options[(index + delta + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    // Move focus with the selection so the roving tabindex stays on the active option.
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    buttons?.[(index + delta + options.length) % options.length]?.focus();
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-white/5 p-0.5 ring-1 ring-inset ring-edge",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={`${groupId}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded font-medium transition-colors duration-(--duration-fast) ease-(--ease-out)",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
              active
                ? "bg-white/10 text-content shadow-sm"
                : "text-muted hover:text-secondary",
            )}
          >
            {option.srLabel ? <span className="sr-only">{option.srLabel}</span> : null}
            <span aria-hidden={option.srLabel ? true : undefined}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
