"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
import { CONTROL_CLASSES, useFieldId } from "./Field";

/** Text/number/datetime input. Pairs with Field, which supplies the label and the id. */
export function Input({ className, id, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = useFieldId();
  return <input id={id ?? fieldId} className={cn(CONTROL_CLASSES, "h-8", className)} {...props} />;
}