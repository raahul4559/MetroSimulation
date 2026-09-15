import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { Surface, SurfaceHeader } from "./Surface";

interface PanelProps extends PropsWithChildren {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Tightens padding for dense rails where several panels stack. */
  dense?: boolean;
  className?: string;
}

/** A titled section. Now a thin composition over Surface — kept as its own name because a
 * dozen call sites read better as `<Panel title="Trains">` than as Surface + header. */
export function Panel({ title, description, action, dense = false, className, children }: PanelProps) {
  return (
    <Surface as="section" padding={dense ? "sm" : "md"} className={cn("min-w-0", className)}>
      <SurfaceHeader
        title={title}
        {...(description !== undefined ? { description } : {})}
        {...(action !== undefined ? { action } : {})}
      />
      {children}
    </Surface>
  );
}
