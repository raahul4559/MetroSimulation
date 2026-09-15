"use client";

import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { CONTROL_CLASSES, useFieldId } from "./Field";

/** Native select with the platform arrow replaced, so it matches Input's chrome exactly.
 * Stays a native <select> on purpose — it is the only listbox that works correctly on mobile. */
export function Select({ className, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = useFieldId();
  return (
    <div className="relative">
      <select
        id={id ?? fieldId}
        className={cn(CONTROL_CLASSES, "h-8 appearance-none pr-7", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}