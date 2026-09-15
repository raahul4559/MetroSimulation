"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import type { SimulationState } from "@/domain/trainsim";
import { SIMULATION_SPEEDS } from "@/domain/trainsim";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { cn } from "@/lib/ui/cn";
import type { Tone } from "@/lib/ui/tone";
import { formatRealDateTime, simulatedTimeOfDay } from "@/lib/metro/clockDisplay";
import { useRealDateTime } from "@/hooks/useRealDateTime";

interface TrainSimulationControlsProps {
  state: SimulationState | null;
  isBusy: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  onSetSpeed: (value: number) => void;
  /**
   * `panel` — the full vertical form, with the wall clock and labelled buttons.
   * `dock`  — one horizontal strip for the floating bar over the map: clock, icon transport,
   *           speed. Same props, same callbacks; only the arrangement differs.
   */
  layout?: "panel" | "dock";
}

const STATUS_TONE: Record<"STOPPED" | "RUNNING" | "PAUSED", Tone> = {
  STOPPED: "neutral",
  RUNNING: "positive",
  PAUSED: "warning",
};

const STATUS_LABEL: Record<"STOPPED" | "RUNNING" | "PAUSED", string> = {
  STOPPED: "Stopped",
  RUNNING: "Running",
  PAUSED: "Paused",
};

const SPEED_OPTIONS: readonly SegmentOption<number>[] = SIMULATION_SPEEDS.map((speed) => ({
  value: speed,
  label: `${speed}×`,
  srLabel: `${speed} times speed`,
}));

export function TrainSimulationControls({
  state,
  isBusy,
  onStart,
  onPause,
  onStop,
  onReset,
  onSetSpeed,
  layout = "panel",
}: TrainSimulationControlsProps) {
  const realDateTime = useRealDateTime();

  if (!state) {
    return (
      <p className={cn("text-xs text-muted", layout === "dock" && "px-2")}>
        Loading simulation state…
      </p>
    );
  }

  const { clock } = state;
  const isRunning = clock.status === "RUNNING";
  const canStop = clock.status !== "STOPPED";

  if (layout === "dock") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="tabular font-mono text-sm leading-none text-content">
            {simulatedTimeOfDay(clock.currentTime)}
          </span>
          <StatusIndicator
            label={STATUS_LABEL[clock.status]}
            tone={STATUS_TONE[clock.status]}
            className="mt-1 text-[10px]"
          />
        </div>

        <span className="h-7 w-px bg-divider" aria-hidden />

        <div className="flex items-center gap-0.5">
          {/* size="md" is 44px on touch and 36px from `md` up — the transport controls are the
              most-tapped thing in the app and must clear the touch-target minimum. */}
          <IconButton
            label={isRunning ? "Pause simulation" : "Start simulation"}
            icon={isRunning ? <Pause size={16} /> : <Play size={16} />}
            variant={isRunning ? "ghost" : "solid"}
            disabled={isBusy}
            onClick={isRunning ? onPause : onStart}
          />
          <IconButton
            label="Stop simulation"
            icon={<Square size={15} />}
            disabled={isBusy || !canStop}
            onClick={onStop}
          />
          <IconButton
            label="Reset simulation"
            icon={<RotateCcw size={15} />}
            disabled={isBusy}
            onClick={onReset}
          />
        </div>

        <span className="h-7 w-px bg-divider" aria-hidden />

        <SegmentedControl
          options={SPEED_OPTIONS}
          value={clock.speed}
          onChange={onSetSpeed}
          size="sm"
          ariaLabel="Simulation speed"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="tabular font-mono text-2xl leading-none text-content">
            {simulatedTimeOfDay(clock.currentTime)}
          </p>
          <p className="tabular mt-1.5 text-xs text-muted">Tick #{clock.currentTick}</p>
        </div>
        <StatusIndicator label={STATUS_LABEL[clock.status]} tone={STATUS_TONE[clock.status]} />
      </div>

      <p className="tabular text-[11px] text-muted">Real time · {formatRealDateTime(realDateTime)}</p>

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          onClick={isRunning ? onPause : onStart}
          disabled={isBusy}
          icon={isRunning ? <Pause size={14} /> : <Play size={14} />}
        >
          {isRunning ? "Pause" : "Start"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onStop}
          disabled={isBusy || !canStop}
          icon={<Square size={13} />}
        >
          Stop
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onReset}
          disabled={isBusy}
          icon={<RotateCcw size={13} />}
        >
          Reset
        </Button>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Speed</p>
        <SegmentedControl
          options={SPEED_OPTIONS}
          value={clock.speed}
          onChange={onSetSpeed}
          size="sm"
          ariaLabel="Simulation speed"
        />
      </div>
    </div>
  );
}
