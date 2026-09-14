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
import { PassengerMetricsPanel } from "@/components/trains/PassengerMetricsPanel";
import { DisruptionPanel } from "@/components/disruptions/DisruptionPanel";
import { ActiveDisruptionsList } from "@/components/disruptions/ActiveDisruptionsList";
import { DelayAnalyticsPanel } from "@/components/disruptions/DelayAnalyticsPanel";
import { useDisruptions } from "@/hooks/useDisruptions";

const EMPTY_PASSENGER_METRICS = {
  totalGenerated: 0,
  totalServed: 0,
  totalUnableToBoard: 0,
  averageWaitSeconds: 0,
  averageTravelSeconds: 0,
  averageJourneySeconds: 0,
};

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
  const { isBusy: disruptionsBusy, error: disruptionsError, create: createDisruption, cancel: cancelDisruption } =
    useDisruptions();

  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const trains = simState?.trains ?? [];
  const signals = simState?.signals ?? [];
  const passengers = simState?.passengers ?? [];
  const passengerMetrics = simState?.passengerMetrics ?? EMPTY_PASSENGER_METRICS;
  const disruptions = simState?.disruptions ?? [];
  const elapsedSeconds = simState?.clock.elapsedSimulationSeconds ?? 0;
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
                signals={signals}
                passengers={passengers}
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

          <Panel title="Passengers">
            <PassengerMetricsPanel
              metrics={passengerMetrics}
              waitingNow={passengers.filter((p) => p.status === "WAITING" || p.status === "TRANSFER").length}
              onTrainNow={passengers.filter((p) => p.status === "ON_TRAIN" || p.status === "BOARDING").length}
            />
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
            <TrainDetails
              train={selectedTrain}
              lines={lines}
              stations={stations}
              tracks={tracks}
              signals={signals}
            />
          </Panel>

          <Panel title="Delay impact">
            <DelayAnalyticsPanel trains={trains} />
          </Panel>

          <Panel title="Create disruption">
            <DisruptionPanel
              stations={stations}
              trains={trains}
              onCreate={createDisruption}
              isBusy={disruptionsBusy}
              error={disruptionsError}
            />
          </Panel>

          <Panel title="Disruptions">
            <ActiveDisruptionsList
              disruptions={disruptions}
              elapsedSeconds={elapsedSeconds}
              onCancel={cancelDisruption}
            />
          </Panel>
        </div>
      </main>
    </div>
  );
}
