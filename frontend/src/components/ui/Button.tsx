import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Leading glyph — a lucide icon at size 16. Decorative; the label carries the meaning. */
  icon?: ReactNode;
  /** Renders the icon after the label instead (for "next"/"open" style actions). */
  trailing?: boolean;
  /** Disables and shows a quiet in-flight state. Does not swap the label, so width stays stable. */
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-white/10 disabled:text-muted",
  secondary:
    "bg-white/5 text-content ring-1 ring-inset ring-edge hover:bg-white/10 disabled:text-muted",
  ghost: "text-secondary hover:bg-white/5 hover:text-content disabled:text-muted",
  danger:
    "bg-danger/10 text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger/20 disabled:text-muted",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  trailing = false,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium",
        "transition-colors duration-(--duration-fast) ease-(--ease-out)",
        "disabled:cursor-not-allowed",
        loading && "opacity-70",
        fullWidth && "w-full",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {icon && !trailing && <span className="shrink-0">{icon}</span>}
      {children}
      {icon && trailing && <span className="shrink-0">{icon}</span>}
    </button>
  );
}
