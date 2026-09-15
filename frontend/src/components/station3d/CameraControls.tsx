"use client";

import { Eye, Orbit, RotateCcw, TrainFront, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CameraMode3D } from "@/domain/station3d";
import { cn } from "@/lib/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";

const MODES: readonly { mode: CameraMode3D; label: string; icon: LucideIcon }[] = [
  { mode: "OVERVIEW", label: "Orbit", icon: Orbit },
  { mode: "FOLLOW", label: "Follow train", icon: TrainFront },
  { mode: "PASSENGER", label: "Platform", icon: User },
  { mode: "FREE", label: "Free camera", icon: Eye },
];

interface CameraControlsProps {
  mode: CameraMode3D;
  onModeChange: (mode: CameraMode3D) => void;
  onReset: () => void;
}

/**
 * Camera modes, as a vertical rail against the right edge.
 *
 * Icon-first and small: inside a station the 3D environment is the content, and the controls exist
 * to get out of its way. Each button still carries its label as a tooltip and an accessible name,
 * so nothing depends on recognising the glyph.
 */
export function CameraControls({ mode, onModeChange, onReset }: CameraControlsProps) {
  return (
    <Surface
      variant="overlay"
      padding="none"
      className="pointer-events-auto flex flex-col items-stretch gap-0.5 p-1"
    >
      <p className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
        Camera
      </p>
      {MODES.map(({ mode: value, label, icon: Icon }) => {
        const active = value === mode;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-medium",
              "transition-colors duration-(--duration-fast) ease-(--ease-out)",
              active ? "bg-white/10 text-content" : "text-muted hover:bg-white/5 hover:text-secondary",
            )}
          >
            <Icon size={14} aria-hidden className="shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
      <span className="mx-2 my-1 h-px bg-divider" aria-hidden />
      <IconButton
        label="Reset camera"
        icon={<RotateCcw size={14} />}
        size="sm"
        onClick={onReset}
        tooltipSide="left"
        className="self-center"
      />
    </Surface>
  );
}
