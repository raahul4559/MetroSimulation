"use client";

import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useMapPreferences } from "@/hooks/useMapPreferences";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { AudioSettingsControls } from "./AudioSettingsControls";
import { ToggleRow } from "./ToggleRow";

/**
 * Display and audio preferences.
 *
 * Collects settings that were previously scattered — map label visibility lived in a toolbar
 * button over the map, and every audio control was buried behind a speaker emoji inside the 3D
 * view, reachable only once you had already entered a station.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [preferences, updatePreferences] = useMapPreferences();
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        label="Settings"
        icon={<Settings size={16} />}
        size="sm"
        active={open}
        onClick={() => setOpen((v) => !v)}
        tooltipSide="bottom"
      />

      {open && (
        <div
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 top-full z-[var(--z-toast)] mt-2 w-72 rounded-lg bg-surface p-2 shadow-lg ring-1 ring-edge motion-safe:animate-[panel-in_var(--duration-fast)_var(--ease-out)]"
        >
          <p className="px-1.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
            Map display
          </p>
          <ToggleRow
            label="Station labels"
            checked={preferences.labelsVisible}
            onChange={(labelsVisible) => updatePreferences({ labelsVisible })}
          />
          <ToggleRow
            label="Passenger density"
            hint="Halo around busy stations"
            checked={preferences.densityVisible}
            onChange={(densityVisible) => updatePreferences({ densityVisible })}
          />
          <ToggleRow
            label="Block signals"
            hint="Signalling overlay, for debugging"
            checked={preferences.signalsVisible}
            onChange={(signalsVisible) => updatePreferences({ signalsVisible })}
          />

          <div className="my-2 h-px bg-divider" />

          <p className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
            Audio
          </p>
          <AudioSettingsControls />

          {reducedMotion && (
            <p className="mt-2 rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-muted">
              Reduced motion is on in your system settings — transitions are disabled.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
