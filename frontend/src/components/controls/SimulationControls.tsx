import type { Simulation } from "@/domain";
import { Button } from "@/components/ui/Button";

interface SimulationControlsProps {
  simulation: Simulation | null;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  isBusy: boolean;
}

export function SimulationControls({
  simulation,
  onStart,
  onPause,
  onReset,
  isBusy,
}: SimulationControlsProps) {
  const isRunning = simulation?.status === "RUNNING";

  return (
    <div className="flex gap-2">
      <Button onClick={onStart} disabled={isBusy || isRunning}>
        Start
      </Button>
      <Button variant="secondary" onClick={onPause} disabled={isBusy || !isRunning}>
        Pause
      </Button>
      <Button variant="secondary" onClick={onReset} disabled={isBusy}>
        Reset
      </Button>
    </div>
  );
}
