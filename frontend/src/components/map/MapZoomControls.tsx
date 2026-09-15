"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";

interface MapZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitNetwork: () => void;
}

/**
 * Zoom controls, docked to the map's right edge.
 *
 * Moved out of the old top toolbar, which put line toggles, a label switch and the zoom stepper in
 * one horizontal bar across the top of the map — the busiest edge of the most important element on
 * the page. A vertical stack on the right is where anyone who has used a map expects to find this.
 */
export function MapZoomControls({ scale, onZoomIn, onZoomOut, onFitNetwork }: MapZoomControlsProps) {
  return (
    <Surface
      variant="overlay"
      padding="none"
      className="pointer-events-auto flex flex-col items-center gap-0.5 p-1"
    >
      <IconButton
        label="Zoom in"
        icon={<Plus size={16} />}
        size="sm"
        onClick={onZoomIn}
        tooltipSide="left"
      />
      <span className="tabular px-1 text-[10px] text-muted" aria-hidden>
        {Math.round(scale * 100)}%
      </span>
      <IconButton
        label="Zoom out"
        icon={<Minus size={16} />}
        size="sm"
        onClick={onZoomOut}
        tooltipSide="left"
      />
      <span className="my-0.5 h-px w-5 bg-divider" aria-hidden />
      <IconButton
        label="Fit network in view"
        icon={<Maximize2 size={15} />}
        size="sm"
        onClick={onFitNetwork}
        tooltipSide="left"
      />
    </Surface>
  );
}
