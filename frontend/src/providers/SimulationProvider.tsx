"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { CreateDisruptionRequest, PassengerMetrics, SimulationClock } from "@/domain/trainsim";
import { useNetwork } from "@/hooks/useNetwork";
import { useMetroRealtime } from "@/hooks/useMetroRealtime";
import { useSimulationControls } from "@/hooks/useSimulationControls";
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
import { describeFeed } from "@/lib/realtime/provenance";
import { TrainMotionStore } from "@/lib/realtime/trainMotion";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { simulatedTimeOfDay } from "@/lib/metro/clockDisplay";
import { formatIstTimeOfDay } from "@/lib/realtime/serverClock";

/**
 * The frontend store: the single owner of the realtime connection.
 *
 * It subscribes once to the canonical `/topic/realtime/state` (via `useMetroRealtime`) and
 * publishes that one frame to every view — 2D map, 3D station, boards, announcements, operations —
 * so they cannot disagree about where a train is or where that position came from. Whether the
 * frame came from an authorized feed, GTFS-Realtime, the timetable or the simulation is decided on
 * the server; nothing here branches on it except to label it (`feed`, from `describeFeed`).
 *
 * Opening one socket per consumer would mean independently-diverging copies of the same state, so
 * this provider calls each data hook exactly once and publishes the result.
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
/** The single train-motion store. Its identity never changes; its contents change per frame. */
const TrainMotionContext = createContext<TrainMotionStore | null>(null);

/** Fallbacks for the window before the first frame, and while a non-simulation source is active. */
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
  const realtime = useMetroRealtime();
  const sim = useSimulationControls(realtime.refresh);
  const lineVisibility = useLineVisibility();
  const disruptions = useDisruptions();

  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  /*
   * `useSimulationControls` and `useDisruptions` both return a fresh object with fresh arrow functions
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

  const { frame, connectionStatus, stalled, reconnectCount, lastFrameReceivedAtMs } = realtime;

  /*
   * The one animation system for trains (see `lib/realtime/trainMotion`). Fed every canonical frame
   * here, read by the 2D map's and the 3D scene's per-display-frame loops. A layout effect so the
   * new keyframe is in place before the browser paints the frame that rendered it.
   */
  const [motion] = useState(() => new TrainMotionStore());
  const reducedMotion = usePrefersReducedMotion();
  useLayoutEffect(() => motion.setNetwork(network.lines, network.tracks), [motion, network.lines, network.tracks]);
  useLayoutEffect(() => motion.setReducedMotion(reducedMotion), [motion, reducedMotion]);
  useLayoutEffect(() => {
    if (frame) motion.ingest(frame.trains, frame.serverEpochMillis, performance.now());
  }, [motion, frame]);

  const data = useMemo<SimulationDataValue>(() => {
    const extras = frame?.simulation ?? null;
    const clock = extras?.clock ?? EMPTY_CLOCK;
    const trains = frame?.trains ?? [];
    const service = frame?.service ?? null;
    return {
      state: frame,
      connectionStatus,
      stalled,
      reconnectCount,
      lastFrameReceivedAtMs,
      feed: describeFeed(frame, connectionStatus, stalled),
      isSimulationSource: frame?.activeSource === "SIMULATION",
      clock,
      // The simulated instant is wall-clock-free; every other source runs on server time in IST.
      timeOfDay: extras
        ? simulatedTimeOfDay(clock.currentTime)
        : frame
          ? formatIstTimeOfDay(frame.serverEpochMillis)
          : "--:--:--",
      serviceRunning: extras
        ? clock.status === "RUNNING"
        : trains.length > 0 || service?.operating === true,
      trains,
      service,
      alerts: frame?.alerts ?? [],
      providers: frame?.providers ?? [],
      // Signals, passengers and injected disruptions exist only inside the simulation; no feed
      // reports them, and none are invented when another source is active.
      signals: extras?.signals ?? [],
      passengers: extras?.passengers ?? [],
      disruptions: extras?.disruptions ?? [],
      passengerMetrics: extras?.passengerMetrics ?? EMPTY_PASSENGER_METRICS,
    };
  }, [frame, connectionStatus, stalled, reconnectCount, lastFrameReceivedAtMs]);

  const actions = useMemo<SimulationActionsValue>(
    () => ({
      isBusy: sim.isBusy,
      error: sim.error ?? realtime.error,
      start,
      pause,
      stop,
      reset,
      setSpeed,
    }),
    [sim.isBusy, sim.error, realtime.error, start, pause, stop, reset, setSpeed],
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
              <TrainMotionContext value={motion}>
                <SimulationDataContext value={data}>{children}</SimulationDataContext>
              </TrainMotionContext>
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

/** Where each train is drawn right now — the shared motion store. See `lib/realtime/trainMotion`. */
export function useTrainMotion(): TrainMotionStore {
  return required(useContext(TrainMotionContext), "useTrainMotion");
}

/**
 * Re-provides the motion store inside a separate React renderer — the 3D `<Canvas>` — which does
 * not inherit the DOM tree's contexts reliably.
 */
export function TrainMotionProvider({ value, children }: PropsWithChildren<{ value: TrainMotionStore | null }>) {
  return <TrainMotionContext value={value}>{children}</TrainMotionContext>;
}

/** Null outside the live provider; for renderers that also work standalone. */
export function useOptionalTrainMotion(): TrainMotionStore | null {
  return useContext(TrainMotionContext);
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
