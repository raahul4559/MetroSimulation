"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Line, Station } from "@/domain/metro";
import type { Disruption, Passenger, SimulationClock, TrainState } from "@/domain/trainsim";
import type { CameraMode3D } from "@/domain/station3d";
import { buildStationLayout3D } from "@/lib/station3d/layout";
import { findUpcomingTrainCode, selectStationTrainVisuals } from "@/lib/station3d/trainVisual";
import { buildPlatformDestinations } from "@/lib/station3d/interchangeSignage";
import { atmosphereFor } from "@/lib/station3d/atmosphere";
import { getStationConfig } from "@/config/stations/stationConfigs";
import { StationModel } from "./StationModel";
import { CameraController } from "./CameraController";
import { AudioListenerSync } from "./AudioListenerSync";
import { SceneReadySignal } from "./SceneReadySignal";
import { Station3DOverlay } from "./Station3DOverlay";
import { simulatedTimeOfDay } from "@/lib/metro/clockDisplay";
import { useStationAsset } from "@/hooks/useStationAsset";
import { useStationReferences } from "@/hooks/useStationReferences";
import { useStationAnnouncements } from "@/hooks/useStationAnnouncements";
import { audioManager } from "@/lib/audio/AudioManager";
import { announcementService, type AnnouncementCaption } from "@/lib/announcements/AnnouncementService";

interface StationSceneProps {
  station: Station;
  lines: readonly Line[];
  stations: readonly Station[];
  trains: readonly TrainState[];
  passengers: readonly Passenger[];
  disruptions?: readonly Disruption[];
  clock: SimulationClock;
  onBack: () => void;
  /**
   * Fired once the canvas has actually drawn its first frames for this station — the signal a
   * transition owner needs before revealing the scene. Absent when the scene is mounted directly,
   * with no transition around it.
   */
  onReady?: (() => void) | undefined;
  /** Hides this scene's own HTML chrome while a transition overlay is covering it, so the station
   * name doesn't appear twice during the hand-off. */
  chromeHidden?: boolean | undefined;
}

/**
 * The 3D station view's top-level component: builds the station's procedural layout and resolves
 * which real trains are currently visible there, owns camera-mode/selection/audio UI state, and
 * renders the WebGL canvas plus its HTML overlay. Everything it feeds into the scene comes from the
 * same `SimulationState` the 2D map reads (`trains`, `passengers`, `clock`) and the same network
 * data (`lines`/`stations`) — this component runs no simulation of its own. Announcements
 * (`useStationAnnouncements` deriving events, `AnnouncementService` speaking them) and non-speech
 * audio (`audioManager`) are likewise both driven purely by the real `TrainVisual3D`
 * phase/disruption transitions computed here, never invented independently. This component only
 * ever hands a real `AnnouncementEvent` to `AnnouncementService` — it never builds announcement text
 * or picks a voice itself, that logic lives entirely outside the 3D scene.
 */
export function StationScene({
  station,
  lines,
  stations,
  trains,
  passengers,
  disruptions = [],
  clock,
  onBack,
  onReady,
  chromeHidden = false,
}: StationSceneProps) {
  const stationsById = useMemo(() => new Map(stations.map((s) => [s.id, s] as const)), [stations]);
  const lineByCode = useMemo(() => new Map(lines.map((l) => [l.code, l] as const)), [lines]);
  const layout = useMemo(() => buildStationLayout3D(station, lines, stationsById), [station, lines, stationsById]);
  const config = useMemo(() => getStationConfig(station, lines), [station, lines]);
  const platformDestinations = useMemo(
    () => buildPlatformDestinations(layout.platforms, lines),
    [layout.platforms, lines]
  );
  const atmosphere = useMemo(() => atmosphereFor(config.buildType), [config.buildType]);

  const trainVisuals = useMemo(() => {
    const platformsByLine = new Map(layout.platforms.map((p) => [p.lineCode, p] as const));
    return selectStationTrainVisuals(trains, station.id, platformsByLine, lineByCode, stationsById);
  }, [trains, station.id, layout.platforms, lineByCode, stationsById]);

  const [cameraMode, setCameraMode] = useState<CameraMode3D>("OVERVIEW");
  const [resetToken, setResetToken] = useState(0);
  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [caption, setCaption] = useState<AnnouncementCaption | null>(null);
  const references = useStationReferences(config.id);

  const { latest: latestAnnouncement, consume: consumeAnnouncement } = useStationAnnouncements(
    layout,
    trainVisuals,
    disruptions
  );

  // Every real announcement event this station fires is handed to `AnnouncementService` (which
  // resolves the operator's configured language(s), builds the natural per-language text, and
  // speaks them in sequence — none of that logic lives here) plus whichever discrete non-speech
  // sound effect matches it, then consumed exactly once so it never replays on an unrelated
  // re-render.
  useEffect(() => {
    if (!latestAnnouncement) return;
    announcementService.announce(latestAnnouncement);
    if (latestAnnouncement.type === "DOORS_OPENING") audioManager.playDoorChime("open");
    if (latestAnnouncement.type === "DOORS_CLOSING") audioManager.playDoorChime("close");
    if (latestAnnouncement.type === "TRAIN_APPROACHING") audioManager.playTrainRumble(0.4, 2);
    if (latestAnnouncement.type === "TRAIN_DEPARTING") audioManager.playTrainRumble(0.5, 2.5);
    consumeAnnouncement();
  }, [latestAnnouncement, consumeAnnouncement]);

  // The caption always mirrors exactly what's audibly playing right now (including which language),
  // not a fixed English string — `AnnouncementService` clears it itself the moment playback stops.
  useEffect(() => announcementService.subscribeCaption(setCaption), []);

  // Tells the PA audio graph which acoustic coloring to use for this station (see `lib/audio/pa.ts`)
  // — genuinely real per-station data (`config.buildType`), not a hardcoded announcement decision;
  // the 3D scene still never builds announcement text or picks a voice itself.
  useEffect(() => {
    audioManager.setAcousticContext(config.buildType);
  }, [config.buildType]);

  // Ambience/door/rumble sounds live on a module-level singleton so they survive this component
  // remounting on the next station — only stop the ambience loop, and any in-flight/queued
  // announcements, here.
  useEffect(
    () => () => {
      audioManager.leaveScene();
      announcementService.stopAll();
    },
    []
  );

  // A train that leaves this station's visible window (boarded away, or the phase resolver drops
  // it) should stop being "selected" rather than silently keep a dangling id around. Deferred a
  // microtask so the setState is async, not synchronous within the effect body (avoids
  // react-hooks/set-state-in-effect).
  useEffect(() => {
    if (selectedTrainId == null || trainVisuals.some((t) => t.trainId === selectedTrainId)) return;
    Promise.resolve().then(() => setSelectedTrainId(null));
  }, [trainVisuals, selectedTrainId]);

  // Re-run the station's own layout/selection whenever the operator switches stations — camera mode
  // resets to Overview so a new station always opens on the same establishing shot.
  useEffect(() => {
    Promise.resolve().then(() => {
      setCameraMode("OVERVIEW");
      setSelectedTrainId(null);
      setResetToken((t) => t + 1);
    });
  }, [station.id]);

  const asset = useStationAsset(config);

  const selectedTrain = trainVisuals.find((t) => t.trainId === selectedTrainId) ?? trainVisuals[0] ?? null;
  const selectedPlatform = selectedTrain ? layout.platforms.find((p) => p.lineCode === selectedTrain.lineCode) : layout.platforms[0];

  const nextTrainCode = selectedTrain
    ? findUpcomingTrainCode(trains, station.id, selectedTrain.lineCode, selectedTrain.direction, selectedTrain.trainId)
    : null;

  // Real-time boarding/alighting headcounts for whichever train is selected and currently
  // dwelling — read straight off the shared passenger roster, not tracked separately.
  const boardingCount =
    selectedTrain?.phase === "BOARDING"
      ? passengers.filter((p) => p.status === "BOARDING" && p.currentTrainId === selectedTrain.trainId).length
      : 0;
  const alightingCount =
    selectedTrain?.phase === "BOARDING"
      ? passengers.filter((p) => p.status === "ALIGHTING" && p.currentStationId === station.id).length
      : 0;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-canvas"
      onPointerDown={() => audioManager.ensureContext()}
    >
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 600 }} dpr={[1, 1.75]}>
        <Suspense fallback={null}>
          <color attach="background" args={[atmosphere.background]} />
          <fog attach="fog" args={[atmosphere.background, atmosphere.fogNear, atmosphere.fogFar]} />
          <StationModel
            layout={layout}
            trains={trainVisuals}
            passengers={passengers}
            asset={asset}
            platformDestinations={platformDestinations}
            selectedTrainId={selectedTrainId}
            onSelectTrain={setSelectedTrainId}
          />
          <CameraController
            mode={cameraMode}
            layout={layout}
            trains={trainVisuals}
            buildType={config.buildType}
            resetToken={resetToken}
          />
          <AudioListenerSync />
          {onReady && <SceneReadySignal onReady={onReady} />}
        </Suspense>
      </Canvas>

      <Station3DOverlay
        station={station}
        config={config}
        quality={asset.quality}
        platformLabel={
          selectedPlatform
            ? `Platform ${selectedPlatform.platformNumber} · ${selectedPlatform.lineName}`
            : null
        }
        clockTime={simulatedTimeOfDay(clock.currentTime)}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
        onResetCamera={() => setResetToken((t) => t + 1)}
        onBack={onBack}
        caption={caption}
        reference={references.status === "ready" ? references.data : null}
        train={selectedTrain}
        platform={selectedPlatform}
        trains={trainVisuals}
        selectedTrainId={selectedTrainId}
        onSelectTrain={setSelectedTrainId}
        nextTrainCode={nextTrainCode}
        boardingCount={boardingCount}
        alightingCount={alightingCount}
        hidden={chromeHidden}
      />
    </div>
  );
}
