import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { Tooltip } from "./Tooltip";

type Variant = "ghost" | "overlay" | "solid";
type Size = "sm" | "md";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required, and doubles as the tooltip text — an icon-only control must always name itself. */
  label: string;
  icon: ReactNode;
  variant?: Variant;
  size?: Size;
  active?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /** Suppresses the tooltip where the surrounding control already explains itself. */
  hideTooltip?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  ghost: "text-secondary hover:bg-white/5 hover:text-content",
  overlay:
    "bg-surface/80 text-secondary ring-1 ring-inset ring-edge backdrop-blur-xl hover:bg-surface-raised hover:text-content",
  solid: "bg-accent text-white hover:bg-accent-hover",
};

const SIZE_CLASSES: Record<Size, string> = {
  // 36/44px hit areas — the md size clears the touch-target minimum on its own.
  sm: "size-8",
  md: "size-11 md:size-9",
};

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  active = false,
  tooltipSide = "top",
  hideTooltip = false,
  className,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={props.onClick && active ? true : undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        "transition-colors duration-(--duration-fast) ease-(--ease-out)",
        "disabled:cursor-not-allowed disabled:text-muted",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        active && variant !== "solid" && "bg-white/10 text-content",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );

  if (hideTooltip) return button;
  return (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  );
}
