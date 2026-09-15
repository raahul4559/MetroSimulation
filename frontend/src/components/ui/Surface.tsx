import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type SurfaceVariant = "panel" | "overlay" | "sunken" | "bare";
type SurfacePadding = "none" | "sm" | "md" | "lg";

interface SurfaceProps extends PropsWithChildren {
  /**
   * `panel`   — an in-flow card sitting on the canvas.
   * `overlay` — floats above the map or the 3D scene; translucent + blurred so the thing it
   *             covers stays legible underneath. This is the only variant that gets glass.
   * `sunken`  — a well *inside* a panel (chart plots, track backgrounds, code-ish regions).
   * `bare`    — structure without decoration, for when a parent already drew the edge.
   */
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  /** Container element. Constrained to the handful of landmarks a card is ever legitimately
   * rendered as, which keeps the children typing sound (a bare ElementType widens it to never). */
  as?: "div" | "section" | "article" | "aside" | "figure" | "li";
  className?: string;
}

const VARIANT_CLASSES: Record<SurfaceVariant, string> = {
  panel: "bg-surface border border-edge shadow-sm",
  overlay: "bg-surface/80 border border-edge shadow-lg backdrop-blur-xl",
  sunken: "bg-surface-sunken border border-divider",
  bare: "",
};

const PADDING_CLASSES: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

/**
 * The one card primitive.
 *
 * Four near-identical card recipes used to live independently in Panel, ChartCard, StatTile and
 * DelayAnalyticsPanel, drifting apart by a border shade and a radius step each time someone added
 * one. Everything with an edge and a background now comes from here, so "what does a card look
 * like" has exactly one answer.
 */
export function Surface({
  variant = "panel",
  padding = "md",
  as: Tag = "div",
  className,
  children,
}: SurfaceProps) {
  return (
    <Tag className={cn("rounded-lg", VARIANT_CLASSES[variant], PADDING_CLASSES[padding], className)}>
      {children}
    </Tag>
  );
}

interface SurfaceHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Section heading used inside a Surface. Metadata-weight by design — see the type scale. */
export function SurfaceHeader({ title, description, action, className }: SurfaceHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h2>
        {description && <p className="mt-1 text-xs text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
