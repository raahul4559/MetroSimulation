"use client";

import { useEffect } from "react";
import {
  useDisruptionActions,
  useLineVisibilityContext,
  useNetworkData,
  useSimulationActions,
  useSimulationData,
  useTrainSelection,
} from "@/providers/SimulationProvider";
import { useToast } from "@/components/ui/Toast";
import { Panel } from "@/components/ui/Panel";
import { Metric } from "@/components/ui/Metric";
import { Surface } from "@/components/ui/Surface";
import { TrainList } from "@/components/trains/TrainList";
import { TrainDetails } from "@/components/trains/TrainDetails";
import { LineFilter } from "@/components/trains/LineFilter";
import { PassengerMetricsPanel } from "@/components/trains/PassengerMetricsPanel";
import { DelayAnalyticsPanel } from "@/components/disruptions/DelayAnalyticsPanel";
import { DisruptionPanel } from "@/components/disruptions/DisruptionPanel";
import { ActiveDisruptionsList } from "@/components/disruptions/ActiveDisruptionsList";
import { HeadwayPanel } from "@/components/operations/HeadwayPanel";
import { StationCongestionPanel } from "@/components/operations/StationCongestionPanel";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

/**
 * The operations dashboard.
 *
 * Everything that used to be stacked in a 300px rail beside the map, given room to be read — plus
 * the two views that rail had no space for at all (headway regularity and station congestion).
 *
 * Built entirely from components and data that already existed: no new endpoint, no new simulation
 * state. Headway and congestion are display-layer derivations over the live roster (see
 * `lib/metro/headway`). This page is the only thing here that touches context; every panel below
 * still takes its data as props, which keeps them presentational and independently testable.
 */
export default function OperationsPage() {
  const { lines, stations, tracks } = useNetworkData();
  const { trains, signals, passengers, disruptions, passengerMetrics, clock } = useSimulationData();
  const { hiddenLineCodes, toggleLine } = useLineVisibilityContext();
  const { selectedTrainId, selectTrain } = useTrainSelection();
  const simActions = useSimulationActions();
  const disruptionActions = useDisruptionActions();
  const { push } = useToast();

  useEffect(() => {
    if (!disruptionActions.error) return;
    push({
      title: "Disruption command failed",
      description: disruptionActions.error,
      tone: "danger",
    });
  }, [disruptionActions.error, push]);

  const selectedTrain = trains.find((t) => t.id === selectedTrainId) ?? null;
  const running = trains.filter((t) => t.status !== "SCHEDULED" && t.status !== "COMPLETED");
  const delayed = running.filter((t) => t.delaySeconds > 0);
  const onTimePct = running.length === 0 ? 100 : ((running.length - delayed.length) / running.length) * 100;
  const avgDelay =
    running.length === 0
      ? 0
      : Math.round(running.reduce((sum, t) => sum + t.delaySeconds, 0) / running.length);
  const waitingNow = passengers.filter(
    (p) => p.status === "WAITING" || p.status === "TRANSFER",
  ).length;
  const onTrainNow = passengers.filter(
    (p) => p.status === "ON_TRAIN" || p.status === "BOARDING",
  ).length;
  const activeDisruptions = disruptions.filter((d) => d.status === "ACTIVE");

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-content">Live Operations</h1>
          <p className="mt-1 text-xs text-secondary">
            Everything currently happening on the network, updated every simulation tick.
          </p>
        </div>
        <StatusIndicator
          label={clock.status === "RUNNING" ? "Simulation running" : `Simulation ${clock.status.toLowerCase()}`}
          tone={clock.status === "RUNNING" ? "positive" : "neutral"}
          size="md"
        />
      </header>

      {/* Network status — a compact row, not six oversized cards. */}
      <Surface>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Trains running" value={running.length} />
          <Metric
            label="On time"
            value={onTimePct.toFixed(0)}
            unit="%"
            tone={onTimePct >= 90 ? "positive" : onTimePct >= 75 ? "warning" : "danger"}
          />
          <Metric
            label="Avg delay"
            value={avgDelay > 0 ? formatDurationSeconds(avgDelay) : "None"}
            tone={avgDelay > 0 ? "warning" : "neutral"}
          />
          <Metric label="Waiting" value={waitingNow.toLocaleString()} />
          <Metric label="On trains" value={onTrainNow.toLocaleString()} />
          <Metric
            label="Active disruptions"
            value={activeDisruptions.length}
            tone={activeDisruptions.length > 0 ? "danger" : "neutral"}
          />
        </div>
      </Surface>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Panel
            title="Active trains"
            description="Select a train to see its detail and focus it on the network map."
          >
            <TrainList
              trains={trains}
              lines={lines}
              stations={stations}
              hiddenLineCodes={hiddenLineCodes}
              selectedTrainId={selectedTrainId}
              onSelectTrain={selectTrain}
              maxHeightClass="max-h-[420px]"
            />
          </Panel>

          <Panel title="Headway" description="Observed spacing between consecutive trains.">
            <HeadwayPanel trains={trains} lines={lines} tracks={tracks} />
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Station congestion" description="Passengers waiting, busiest first.">
              <StationCongestionPanel passengers={passengers} stations={stations} />
            </Panel>

            <Panel title="Passenger demand">
              <PassengerMetricsPanel
                metrics={passengerMetrics}
                waitingNow={waitingNow}
                onTrainNow={onTrainNow}
              />
            </Panel>
          </div>

          <Panel title="Delays">
            <DelayAnalyticsPanel trains={trains} columns={5} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Train detail">
            <TrainDetails
              train={selectedTrain}
              lines={lines}
              stations={stations}
              tracks={tracks}
              signals={signals}
            />
          </Panel>

          <Panel title="Line filter" description="Shared with the network map.">
            <LineFilter lines={lines} hiddenLineCodes={hiddenLineCodes} onToggleLine={toggleLine} />
          </Panel>

          <Panel title="Create disruption">
            <DisruptionPanel
              stations={stations}
              trains={trains}
              onCreate={disruptionActions.create}
              isBusy={disruptionActions.isBusy}
              error={disruptionActions.error}
            />
          </Panel>

          <Panel title="Service disruptions">
            <ActiveDisruptionsList
              disruptions={disruptions}
              elapsedSeconds={clock.elapsedSimulationSeconds}
              onCancel={disruptionActions.cancel}
            />
          </Panel>
        </div>
      </div>

      {/* The dock in the (live) layout carries transport; this keeps the busy state honest when a
          command is in flight from elsewhere. */}
      {simActions.isBusy && (
        <p className="text-center text-[11px] text-muted">Applying simulation command…</p>
      )}
    </main>
  );
}
