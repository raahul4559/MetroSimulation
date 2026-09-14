import type { SimulationState } from "@/domain/trainsim";
import { SIMULATION_SPEEDS } from "@/domain/trainsim";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface TrainSimulationControlsProps {
  state: SimulationState | null;
  isBusy: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset: () => void;
  onSetSpeed: (value: number) => void;
}

const STATUS_TONE = {
  STOPPED: "neutral",
  RUNNING: "positive",
  PAUSED: "warning",
} as const;

function timeOfDay(isoInstant: string): string {
  const date = new Date(isoInstant);
  return date.toISOString().slice(11, 19);
}

export function TrainSimulationControls({
  state,
  isBusy,
  onStart,
  onPause,
  onStop,
  onReset,
  onSetSpeed,
}: TrainSimulationControlsProps) {
  if (!state) {
    return <p className="text-sm text-slate-500">Loading simulation state…</p>;
  }

  const { clock } = state;
  const isRunning = clock.status === "RUNNING";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-2xl text-slate-100">{timeOfDay(clock.currentTime)}</p>
          <p className="text-xs text-slate-500">Tick #{clock.currentTick}</p>
        </div>
        <StatusBadge label={clock.status} tone={STATUS_TONE[clock.status]} />
      </div>

      <div className="flex gap-2">
        <Button onClick={onStart} disabled={isBusy || isRunning}>
          Start
        </Button>
        <Button variant="secondary" onClick={onPause} disabled={isBusy || !isRunning}>
          Pause
        </Button>
        <Button variant="secondary" onClick={onStop} disabled={isBusy || clock.status === "STOPPED"}>
          Stop
        </Button>
        <Button variant="secondary" onClick={onReset} disabled={isBusy}>
          Reset
        </Button>
      </div>

      <div>
        <p className="mb-1 text-xs text-slate-500">Speed</p>
        <div className="flex flex-wrap gap-1.5">
          {SIMULATION_SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              disabled={isBusy}
              onClick={() => onSetSpeed(speed)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                clock.speed === speed
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
