"use client";

import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { IconButton } from "./IconButton";

interface BottomSheetProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rendered pinned below the scroll area — the panel's primary action. */
  footer?: ReactNode;
  className?: string;
}

/**
 * One container, two shapes.
 *
 * At `md` and up it is a right-hand rail docked beside the map; below that it becomes a bottom
 * sheet, which is the only form that leaves the map dominant on a phone. Both are the same DOM —
 * the previous version hand-wrote nine responsive positioning utilities inline at the one call
 * site that needed it, which meant nothing else could reuse the behaviour.
 *
 * Focus is trapped while open and Escape closes, because on mobile it covers most of the screen
 * and a keyboard user who tabs past the end has no way back.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  className,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    if (!node) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Scrim on small screens only — on desktop the rail sits beside the map, not over it. */}
      <div
        className="fixed inset-0 z-[var(--z-sheet)] bg-black/40 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "pointer-events-auto z-[var(--z-sheet)] flex flex-col",
          "bg-surface/90 shadow-lg ring-1 ring-edge backdrop-blur-xl",
          // Mobile: bottom sheet.
          "fixed inset-x-0 bottom-0 max-h-[70svh] rounded-t-xl",
          "motion-safe:animate-[sheet-in_var(--duration-slow)_var(--ease-out)]",
          // md+: docked rail.
          "md:absolute md:inset-x-auto md:inset-y-0 md:right-0 md:w-[340px] md:max-h-none md:rounded-none md:rounded-l-xl",
          className,
        )}
      >
        {/* Drag affordance — purely a signal that this sheet is dismissible. */}
        <div className="flex justify-center pt-2 md:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-white/15" />
        </div>

        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-3 md:pt-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-tight text-content">{title}</div>
            {subtitle && <div className="mt-1 text-xs text-secondary">{subtitle}</div>}
          </div>
          <IconButton
            label="Close panel"
            icon={<X size={16} />}
            size="sm"
            onClick={onClose}
            tooltipSide="left"
          />
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>

        {footer && <div className="border-t border-divider p-4">{footer}</div>}
      </div>
    </>
  );
}
