"use client";

import { createContext, useContext, useId, type PropsWithChildren } from "react";
import { cn } from "@/lib/ui/cn";

const FieldIdContext = createContext<string | null>(null);

/** Lets Input/Select adopt the id their Field generated, without the caller wiring htmlFor. */
export function useFieldId(): string | undefined {
  return useContext(FieldIdContext) ?? undefined;
}

interface FieldProps extends PropsWithChildren {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

/**
 * Label + control + hint/error, with the id wiring handled here.
 *
 * Before this, seven raw `<select>`/`<input>` elements shared two hand-copied class strings and
 * none of them were actually labelled — the text next to them was a plain span.
 */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-secondary">
        {label}
      </label>
      <FieldIdContext value={id}>{children}</FieldIdContext>
      {error ? (
        <p className="mt-1 text-[11px] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared control chrome, so Input and Select cannot drift apart the way their ancestors did. */
export const CONTROL_CLASSES = cn(
  "w-full rounded-md bg-surface-sunken px-2.5 text-xs text-content",
  "ring-1 ring-inset ring-edge",
  "transition-colors duration-(--duration-fast) ease-(--ease-out)",
  "hover:ring-edge-strong focus:ring-accent focus:outline-none",
  "disabled:cursor-not-allowed disabled:text-muted",
);
