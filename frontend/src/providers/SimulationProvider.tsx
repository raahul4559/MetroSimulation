"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { CreateDisruptionRequest, PassengerMetrics, SimulationClock } from "@/domain/trainsim";
import { useNetwork } from "@/hooks/useNetwork";
import { useTrainSimulation } from "@/hooks/useTrainSimulation";
import { useLineVisibility } from "@/hooks/useLineVisibility";
import { useDisruptions } from "@/hooks/useDisruptions";
import type {
  DisruptionActionsValue,
  LineVisibilityValue,
  NetworkValue,
  SelectionValue,
  SimulationActionsValue,
  SimulationDataValue,
} from "./simulation-types";

/**
 * The single owner of the live simulation connection.
 *
 * `useTrainSimulation` opens a new STOMP client per call — one `Client`, one subscription to
 * `/topic/train-simulation/state`, one seed fetch, per component that calls it. That was invisible
 * while exactly one page used it; the moment the network view and the operations view both wanted
 * live state it would have meant two sockets delivering two independently-diverging copies of the
 * same simulation. So this provider calls each data hook exactly once and publishes the result.
 *
 * It is mounted by the `(live)` route group's layout rather than the root layout, which is what
 * keeps /stations and /analytics from opening a socket they have no use for.
 *
 * Six contexts rather than one, because they change at wildly different rates — see
 * `simulation-types.ts`. Critically, the layout that mounts this passes `children` in as a prop,
 * so the subtree element is referentially stable: this component re-rendering on every tick does
 * NOT re-render the tree below it, only the components that actually subscribe.
 */

const SimulationDataContext = createContext<SimulationDataValue | null>(null);
const SimulationActionsContext = createContext<SimulationActionsValue | null>(null);
const NetworkContext = createContext<NetworkValue | null>(null);
const LineVisibilityContext = createContext<LineVisibilityValue | null>(null);
const DisruptionActionsContext = createContext<DisruptionActionsValue | null>(null);
const SelectionContext = createContext<SelectionValue | null>(null);

/** Fallbacks for the window between first paint and the first frame off the socket. */
const EMPTY_PASSENGER_METRICS: PassengerMetrics = {
  totalGenerated: 0,
  totalServed: 0,
  totalUnableToBoard: 0,
  averageWaitSeconds: 0,
  averageTravelSeconds: 0,
  averageJourneySeconds: 0,
};

const EMPTY_CLOCK: SimulationClock = {
  startTime: new Date(0).toISOString(),
  currentTime: new Date(0).toISOString(),
  status: "STOPPED",
  speed: 1,
  currentTick: 0,
  elapsedSimulationSeconds: 0,
};

export function SimulationProvider({ children }: PropsWithChildren) {
  const network = useNetwork();
  const sim = useTrainSimulation();
  const lineVisibility = useLineVisibility();
  const disruptions = useDisruptions();

  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  /*
   * `useTrainSimulation` and `useDisruptions` both return a fresh object with fresh arrow functions
   * on every render. We are not changing those hooks, so the identities are stabilised here, at the
   * boundary, using the ref-then-effect idiom already used elsewhere in this codebase (see
   * MetroMap's `trainsRef`). Without this, every consumer of the actions context would re-render on
   * every simulation tick even though nothing it reads has changed.
   */
  const latestSim = useRef(sim);
  useEffect(() => {
    latestSim.current = sim;
  });

  const latestDisruptions = useRef(disruptions);
  useEffect(() => {
    latestDisruptions.current = disruptions;
  });

  const start = useCallback(() => latestSim.current.start(), []);
  const pause = useCallback(() => latestSim.current.pause(), []);
  const stop = useCallback(() => latestSim.current.stop(), []);
  const reset = useCallback(() => latestSim.current.reset(), []);
  const setSpeed = useCallback((value: number) => latestSim.current.setSpeed(value), []);
  const createDisruption = useCallback(
    (request: CreateDisruptionRequest) => latestDisruptions.current.create(request),
    [],
  );
  const cancelDisruption = useCallback((id: number) => latestDisruptions.current.cancel(id), []);

  // A train and a station are mutually exclusive selections — the contextual panel shows one or
  // the other, so picking either clears the other rather than leaving both highlighted.
  const selectTrain = useCallback((id: number | null) => {
    setSelectedTrainId(id);
    if (id != null) {
      setSelectedStationId(null);
      // Bumping the token is what makes re-selecting the same train re-focus the map.
      setFocusToken((t) => t + 1);
    }
  }, []);

  const selectStation = useCallback((id: number | null) => {
    setSelectedStationId(id);
    if (id != null) {
      setSelectedTrainId(null);
      setFocusToken((t) => t + 1);
    }
  }, []);

  const { state } = sim;

  const data = useMemo<SimulationDataValue>(
    () => ({
      state,
      connectionStatus: sim.connectionStatus,
      clock: state?.clock ?? EMPTY_CLOCK,
      trains: state?.trains ?? [],
      signals: state?.signals ?? [],
      passengers: state?.passengers ?? [],
      disruptions: state?.disruptions ?? [],
      passengerMetrics: state?.passengerMetrics ?? EMPTY_PASSENGER_METRICS,
    }),
    [state, sim.connectionStatus],
  );

  const actions = useMemo<SimulationActionsValue>(
    () => ({ isBusy: sim.isBusy, error: sim.error, start, pause, stop, reset, setSpeed }),
    [sim.isBusy, sim.error, start, pause, stop, reset, setSpeed],
  );

  const networkValue = useMemo<NetworkValue>(
    () => ({
      lines: network.lines,
      stations: network.stations,
      tracks: network.tracks,
      interchanges: network.interchanges,
      isLoading: network.isLoading,
      error: network.error,
    }),
    [network],
  );

  const disruptionActions = useMemo<DisruptionActionsValue>(
    () => ({
      isBusy: disruptions.isBusy,
      error: disruptions.error,
      create: createDisruption,
      cancel: cancelDisruption,
    }),
    [disruptions.isBusy, disruptions.error, createDisruption, cancelDisruption],
  );

  const selection = useMemo<SelectionValue>(
    () => ({ selectedTrainId, selectedStationId, focusToken, selectTrain, selectStation }),
    [selectedTrainId, selectedStationId, focusToken, selectTrain, selectStation],
  );

  return (
    <NetworkContext value={networkValue}>
      <SimulationActionsContext value={actions}>
        <LineVisibilityContext value={lineVisibility}>
          <DisruptionActionsContext value={disruptionActions}>
            <SelectionContext value={selection}>
              <SimulationDataContext value={data}>{children}</SimulationDataContext>
            </SelectionContext>
          </DisruptionActionsContext>
        </LineVisibilityContext>
      </SimulationActionsContext>
    </NetworkContext>
  );
}

function required<T>(value: T | null, name: string): T {
  if (value === null) {
    throw new Error(`${name} must be used inside <SimulationProvider> (the (live) route group).`);
  }
  return value;
}

export function useSimulationData(): SimulationDataValue {
  return required(useContext(SimulationDataContext), "useSimulationData");
}

export function useSimulationActions(): SimulationActionsValue {
  return required(useContext(SimulationActionsContext), "useSimulationActions");
}

export function useNetworkData(): NetworkValue {
  return required(useContext(NetworkContext), "useNetworkData");
}

export function useLineVisibilityContext(): LineVisibilityValue {
  return required(useContext(LineVisibilityContext), "useLineVisibilityContext");
}

export function useDisruptionActions(): DisruptionActionsValue {
  return required(useContext(DisruptionActionsContext), "useDisruptionActions");
}

export function useTrainSelection(): SelectionValue {
  return required(useContext(SelectionContext), "useTrainSelection");
}

/** Optional variants for chrome rendered by the root layout, above the provider. */
export function useOptionalNetworkData(): NetworkValue | null {
  return useContext(NetworkContext);
}

export function useOptionalTrainSelection(): SelectionValue | null {
  return useContext(SelectionContext);
}

/**
 * Returns null outside the provider instead of throwing.
 *
 * This is the sanctioned way for chrome rendered by the *root* layout — the navbar's connection
 * badge — to show live status on / and /operations while rendering nothing on /stations and
 * /analytics, without those routes paying for a socket.
 */
export function useOptionalSimulationData(): SimulationDataValue | null {
  return useContext(SimulationDataContext);
}
