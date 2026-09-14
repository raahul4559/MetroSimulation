"use client";

import { useState } from "react";
import { useNetwork } from "@/hooks/useNetwork";
import { useTrainSimulation } from "@/hooks/useTrainSimulation";
import { useLineVisibility } from "@/hooks/useLineVisibility";
import { MetroMap } from "@/components/map/MetroMap";
import { Panel } from "@/components/ui/Panel";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";
import { TrainSimulationControls } from "@/components/trains/TrainSimulationControls";
import { LineFilter } from "@/components/trains/LineFilter";
import { TrainList } from "@/components/trains/TrainList";
import { TrainDetails } from "@/components/trains/TrainDetails";

export default function DashboardPage() {
  const { lines, stations, tracks, isLoading, error: networkError } = useNetwork();
  const {
    state: simState,
    connectionStatus,
    isBusy,
    error: simError,
    start,
    pause,
    stop,
    reset,
    setSpeed,
  } = useTrainSimulation();
  const { hiddenLineCodes, toggleLine } = useLineVisibility();

  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const trains = simState?.trains ?? [];
  const selectedTrain = trains.find((t) => t.id === selectedTrainId) ?? null;

  function selectTrain(id: number | null) {
    setSelectedTrainId(id);
    if (id != null) setFocusToken((t) => t + 1);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Namma Metro Simulation</h1>
          <p className="text-xs text-slate-500">Live train scheduling and dispatch</p>
        </div>
        <ConnectionIndicator status={connectionStatus} />
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr_300px]">
        <Panel title="Network map">
          {isLoading && <p className="text-sm text-slate-500">Loading network…</p>}
          {networkError && <p className="text-sm text-red-400">{networkError}</p>}
          {!isLoading && !networkError && (
            <div className="h-[65vh] min-h-[420px] w-full lg:h-[calc(100vh-160px)]">
              <MetroMap
                lines={lines}
                stations={stations}
                tracks={tracks}
                trains={trains}
                connectionStatus={connectionStatus}
                hiddenLineCodes={hiddenLineCodes}
                onToggleLine={toggleLine}
                selectedTrainId={selectedTrainId}
                onSelectTrain={selectTrain}
                focusToken={focusToken}
              />
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Simulation">
            {simError && <p className="mb-2 text-sm text-red-400">{simError}</p>}
            <TrainSimulationControls
              state={simState}
              isBusy={isBusy}
              onStart={start}
              onPause={pause}
              onStop={stop}
              onReset={reset}
              onSetSpeed={setSpeed}
            />
          </Panel>

          <Panel title="Line filter">
            <LineFilter lines={lines} hiddenLineCodes={hiddenLineCodes} onToggleLine={toggleLine} />
          </Panel>

          <Panel title="Trains">
            <TrainList
              trains={trains}
              lines={lines}
              hiddenLineCodes={hiddenLineCodes}
              selectedTrainId={selectedTrainId}
              onSelectTrain={selectTrain}
            />
          </Panel>

          <Panel title="Train details">
            <TrainDetails train={selectedTrain} lines={lines} stations={stations} />
          </Panel>
        </div>
      </main>
    </div>
  );
}
