"use client";

import { useEffect } from "react";
import { useSimulationActions, useSimulationData } from "@/providers/SimulationProvider";
import { useToast } from "@/components/ui/Toast";
import { Surface } from "@/components/ui/Surface";
import { TrainSimulationControls } from "@/components/trains/TrainSimulationControls";

/**
 * Transport controls, floating at the bottom of the map.
 *
 * Reads from context rather than props so it can be rendered by the `(live)` layout and persist
 * across `/` ⇄ `/operations` — the clock does not restart and the run does not pause because the
 * operator changed tab.
 *
 * Also the one place simulation errors surface. They previously rendered as a red paragraph above
 * whichever panel produced them, which shifted the layout and was invisible if you had scrolled.
 */
export function SimulationControlsDock() {
  const { state } = useSimulationData();
  const actions = useSimulationActions();
  const { push } = useToast();

  useEffect(() => {
    if (!actions.error) return;
    push({ title: "Simulation command failed", description: actions.error, tone: "danger" });
  }, [actions.error, push]);

  return (
    <Surface
      variant="overlay"
      padding="none"
      className="pointer-events-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto px-3 py-2"
    >
      <TrainSimulationControls
        state={state}
        isBusy={actions.isBusy}
        onStart={actions.start}
        onPause={actions.pause}
        onStop={actions.stop}
        onReset={actions.reset}
        onSetSpeed={actions.setSpeed}
        layout="dock"
      />
    </Surface>
  );
}
