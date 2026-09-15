"use client";

import type { Line, Station } from "@/domain/metro";
import type { Disruption, Passenger, SimulationClock, TrainState } from "@/domain/trainsim";
import type { StationConfig } from "@/domain/stationConfig";
import type { StationImmersionPhase } from "@/domain/stationImmersion";
import { useStationSceneLoad } from "@/hooks/useStationSceneLoad";
import { StationScene } from "./StationScene";
import { StationTransitionOverlay } from "./StationTransitionOverlay";

interface StationImmersionSceneProps {
  station: Station;
  config: StationConfig;
  lines: readonly Line[];
  stations: readonly Station[];
  trains: readonly TrainState[];
  passengers: readonly Passenger[];
  disruptions: readonly Disruption[];
  clock: SimulationClock;
  phase: StationImmersionPhase;
  sceneReady: boolean;
  onSceneReady: () => void;
  onBack: () => void;
  showScene: boolean;
  showOverlay: boolean;
  /** 0..1 — how far the scene layer has settled into place. */
  sceneDepth: number;
  /** 0..1 — the transition scrim's opacity. */
  scrimOpacity: number;
}

/**
 * Everything the map → 3D hand-off needs that actually requires three.js.
 *
 * This is the one module in the app that imports `@react-three/fiber`/`@react-three/drei` (via
 * `StationScene` and `useStationSceneLoad`). It exists as its own file so `NetworkStage` can load
 * it with `next/dynamic(..., { ssr: false })` — the plain network map, which is what nearly every
 * visit to `/` actually wants, ships with zero bytes of the 3D stack. The chunk only downloads
 * once the operator asks to enter a station, and the ~900ms camera zoom that follows gives the
 * fetch time to land before the loading overlay actually needs to show real progress.
 */
export function StationImmersionScene({
  station,
  config,
  lines,
  stations,
  trains,
  passengers,
  disruptions,
  clock,
  phase,
  sceneReady,
  onSceneReady,
  onBack,
  showScene,
  showOverlay,
  sceneDepth,
  scrimOpacity,
}: StationImmersionSceneProps) {
  const sceneLoad = useStationSceneLoad({ config, phase, sceneReady });

  return (
    <>
      {showScene && (
        /*
         * Never `hidden`, `display:none` or `visibility:hidden` while warming up. R3F's <Canvas>
         * sizes itself from a resize observer on its parent; a zero-size parent yields a 0x0
         * canvas that never runs useFrame, so the readiness signal never fires and the machine
         * deadlocks in `preparing` until the bail-out timer rescues it. Laid out and transparent.
         */
        <div
          className="absolute inset-0 transition-[opacity,transform] duration-(--duration-cinematic) ease-(--ease-out)"
          style={
            sceneDepth === 1
              ? { opacity: 1, pointerEvents: phase === "immersed" ? "auto" : "none" }
              : {
                  opacity: sceneDepth,
                  transform: `scale(${1.06 - sceneDepth * 0.06})`,
                  pointerEvents: "none",
                  willChange: "transform, opacity",
                }
          }
          aria-hidden={phase !== "immersed"}
        >
          <StationScene
            station={station}
            lines={lines}
            stations={stations}
            trains={trains}
            passengers={passengers}
            disruptions={disruptions}
            clock={clock}
            onBack={onBack}
            onReady={onSceneReady}
            chromeHidden={phase !== "immersed"}
          />
        </div>
      )}

      {showOverlay && (
        <StationTransitionOverlay
          station={station}
          config={config}
          lines={lines}
          load={sceneLoad}
          opacity={scrimOpacity}
        />
      )}
    </>
  );
}
