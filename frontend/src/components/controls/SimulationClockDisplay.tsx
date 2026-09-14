import type { Simulation } from "@/domain";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STATUS_TONE: Record<Simulation["status"], "neutral" | "positive" | "warning"> = {
  STOPPED: "neutral",
  RUNNING: "positive",
  PAUSED: "warning",
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":");
}

export function SimulationClockDisplay({ simulation }: { simulation: Simulation }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono text-2xl text-slate-100">
          {formatElapsed(simulation.elapsedSimulationMs)}
        </p>
        <p className="text-xs text-slate-500">Tick #{simulation.currentTick}</p>
      </div>
      <StatusBadge label={simulation.status} tone={STATUS_TONE[simulation.status]} />
    </div>
  );
}
