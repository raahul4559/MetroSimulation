"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

interface TooltipProps {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
  className?: string;
}

const SIDE_CLASSES: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

/**
 * Hover/focus label for controls whose icon is not self-evident.
 *
 * Shows on focus as well as hover, and the trigger still needs its own aria-label — the tooltip
 * is a visual affordance for sighted users, never the accessible name. A screen reader user
 * should never depend on a hover state to know what a button does.
 */
export function Tooltip({ label, side = "top", children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn("relative inline-flex", className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute z-[var(--z-toast)] whitespace-nowrap rounded-md px-2 py-1",
            "bg-surface-raised text-[11px] text-content shadow-lg ring-1 ring-edge",
            SIDE_CLASSES[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
