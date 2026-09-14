"use client";

import { useNetwork } from "@/hooks/useNetwork";
import { useSimulationState } from "@/hooks/useSimulationState";
import { MetroMap } from "@/components/map/MetroMap";
import { Panel } from "@/components/ui/Panel";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";
import { SimulationClockDisplay } from "@/components/controls/SimulationClockDisplay";
import { SimulationControls } from "@/components/controls/SimulationControls";
import { LineList } from "@/components/network/LineList";
import { StationDetailPanel } from "@/components/network/StationDetailPanel";

export default function DashboardPage() {
  const { lines, stations, tracks, interchanges, isLoading, error: networkError } = useNetwork();
  const {
    simulation,
    connectionStatus,
    isBusy,
    error: simulationError,
    start,
    pause,
    reset,
  } = useSimulationState();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Namma Metro Simulation</h1>
          <p className="text-xs text-slate-500">Graph-based network view</p>
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
                connectionStatus={connectionStatus}
              />
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Simulation">
            {simulationError && <p className="mb-2 text-sm text-red-400">{simulationError}</p>}
            {simulation ? (
              <div className="space-y-4">
                <SimulationClockDisplay simulation={simulation} />
                <SimulationControls
                  simulation={simulation}
                  onStart={start}
                  onPause={pause}
                  onReset={reset}
                  isBusy={isBusy}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading simulation state…</p>
            )}
          </Panel>

          <Panel title="Network summary">
            <StationDetailPanel stations={stations} interchanges={interchanges} />
          </Panel>

          <Panel title="Lines">
            <LineList lines={lines} />
          </Panel>
        </div>
      </main>
    </div>
  );
}
