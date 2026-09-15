"use client";

import type { Disruption, TrainState } from "@/domain/trainsim";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Surface } from "@/components/ui/Surface";
import type { Tone } from "@/lib/ui/tone";

interface NetworkStatusCardProps {
  stationCount: number;
  trains: readonly TrainState[];
  disruptions: readonly Disruption[];
  isRunning: boolean;
}

interface ServiceState {
  readonly label: string;
  readonly tone: Tone;
}

/**
 * How the network is doing, at a glance — the one always-visible summary on the map.
 *
 * Service state is derived rather than reported: the backend has no "service level" concept, so it
 * is composed here from what the simulation does expose — active disruptions first, then how many
 * trains are actually running behind schedule. Deriving it in the display layer keeps the engine
 * unaware of a presentation idea, which is the same division `DelayAnalyticsPanel` already follows.
 */
function serviceState(
  trains: readonly TrainState[],
  disruptions: readonly Disruption[],
  isRunning: boolean,
): ServiceState {
  if (!isRunning) return { label: "Service stopped", tone: "neutral" };

  const active = disruptions.filter((d) => d.status === "ACTIVE");
  if (active.length > 0) {
    return {
      label: active.length === 1 ? "1 active disruption" : `${active.length} active disruptions`,
      tone: "danger",
    };
  }

  const running = trains.filter((t) => t.status !== "SCHEDULED" && t.status !== "COMPLETED");
  const delayed = running.filter((t) => t.delaySeconds > 0);
  // A tenth of the fleet running late is the point at which "normal service" stops being true.
  if (running.length > 0 && delayed.length / running.length > 0.1) {
    return { label: "Minor delays", tone: "warning" };
  }

  return { label: "Normal service", tone: "positive" };
}

export function NetworkStatusCard({
  stationCount,
  trains,
  disruptions,
  isRunning,
}: NetworkStatusCardProps) {
  const running = trains.filter((t) => t.status !== "SCHEDULED" && t.status !== "COMPLETED");
  const service = serviceState(trains, disruptions, isRunning);

  return (
    <Surface variant="overlay" padding="none" className="pointer-events-auto w-[180px] px-3 py-2.5">
      <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted">Network status</h2>
      <ul className="mt-2 space-y-1.5">
        <li>
          <StatusIndicator label={`${stationCount} stations`} tone="neutral" />
        </li>
        <li>
          <StatusIndicator
            label={`${running.length} trains running`}
            tone={running.length > 0 ? "info" : "neutral"}
          />
        </li>
        <li>
          <StatusIndicator label={service.label} tone={service.tone} pulse={service.tone === "danger"} />
        </li>
      </ul>
    </Surface>
  );
}
