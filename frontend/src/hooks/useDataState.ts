"use client";

import { useOptionalSimulationData } from "@/providers/SimulationProvider";
import { useRealDateTime } from "@/hooks/useRealDateTime";
import { describeDataState, type DataState } from "@/lib/realtime/dataState";

export interface DataStateView {
  /** The network-level data state, or null outside the live provider (no realtime on this page). */
  readonly network: DataState | null;
  /** Authoritative server time (epoch ms), ticking once a second even when frames stop. */
  readonly nowMs: number;
}

/**
 * The data state of what is on screen, re-derived every second from the canonical frame and the
 * server clock, so "Updated 6s ago" keeps counting — and turns OFFLINE — when frames stop arriving.
 */
export function useDataState(): DataStateView {
  const sim = useOptionalSimulationData();
  const nowMs = useRealDateTime().getTime();
  if (!sim) return { network: null, nowMs };
  return { network: describeDataState(sim.state, sim.connectionStatus, sim.stalled, nowMs), nowMs };
}
