"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Line, Station } from "@/domain/metro";
import type { Passenger, SimulationClock, TrainState } from "@/domain/trainsim";
import type { CameraMode3D } from "@/domain/station3d";
import { buildStationLayout3D } from "@/lib/station3d/layout";
import { findUpcomingTrainCode, selectStationTrainVisuals } from "@/lib/station3d/trainVisual";
import { formatDurationSeconds, formatOccupancyPercent } from "@/lib/metro/passengerDisplay";
import { buildPlatformDestinations } from "@/lib/station3d/interchangeSignage";
import { atmosphereFor } from "@/lib/station3d/atmosphere";
import { getStationConfig } from "@/config/stations/stationConfigs";
import { StationModel } from "./StationModel";
import { CameraController } from "./CameraController";
import { useStationAsset } from "@/hooks/useStationAsset";
import { useStationAnnouncements } from "@/hooks/useStationAnnouncements";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { audioManager } from "@/lib/audio/AudioManager";

interface StationSceneProps {
  station: Station;
  lines: readonly Line[];
  stations: readonly Station[];
  trains: readonly TrainState[];
  passengers: readonly Passenger[];
  clock: SimulationClock;
  onBack: () => void;
}

const CAMERA_MODES: readonly { mode: CameraMode3D; label: string }[] = [
  { mode: "OVERVIEW", label: "Station Overview" },
  { mode: "PASSENGER", label: "Passenger View" },
  { mode: "FOLLOW", label: "Follow Train" },
  { mode: "FREE", label: "Free Camera" },
];

const CAPTION_VISIBLE_MS = 4500;

/**
 * The 3D station view's top-level component: builds the station's procedural layout and resolves
 * which real trains are currently visible there, owns camera-mode/selection/audio UI state, and
 * renders the WebGL canvas plus its HTML overlay. Everything it feeds into the scene comes from the
 * same `SimulationState` the 2D map reads (`trains`, `passengers`, `clock`) and the same network
 * data (`lines`/`stations`) — this component runs no simulation of its own. Announcements
 * (`useStationAnnouncements`) and audio (`audioManager`) are likewise both driven purely by the real
 * `TrainVisual3D` phase transitions computed here, never invented independently.
 */
export function StationScene({ station, lines, stations, trains, passengers, clock, onBack }: StationSceneProps) {
  const stationsById = useMemo(() => new Map(stations.map((s) => [s.id, s] as const)), [stations]);
  const lineByCode = useMemo(() => new Map(lines.map((l) => [l.code, l] as const)), [lines]);
  const layout = useMemo(() => buildStationLayout3D(station, lines, stationsById), [station, lines, stationsById]);

  const trainVisuals = useMemo(() => {
    const platformsByLine = new Map(layout.platforms.map((p) => [p.lineCode, p] as const));
    return selectStationTrainVisuals(trains, station.id, platformsByLine, lineByCode, stationsById);
  }, [trains, station.id, layout.platforms, lineByCode, stationsById]);

  const [cameraMode, setCameraMode] = useState<CameraMode3D>("OVERVIEW");
  const [resetToken, setResetToken] = useState(0);
  const [selectedTrainId, setSelectedTrainId] = useState<number | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  const [audioSettings, updateAudioSettings] = useAudioSettings();

  const { latest: latestAnnouncement, consume: consumeAnnouncement } = useStationAnnouncements(layout, trainVisuals);

  // Every announcement this station fires plays through the same two channels — speech + the
  // matching discrete sound effect — and shows as a caption, all off the one real event, then is
  // consumed exactly once so it never replays on an unrelated re-render.
  useEffect(() => {
    if (!latestAnnouncement) return;
    const message = latestAnnouncement.message;
    audioManager.speak(message);
    if (latestAnnouncement.type === "DOORS_OPENING") audioManager.playDoorChime("open");
    if (latestAnnouncement.type === "DOORS_CLOSING") audioManager.playDoorChime("close");
    if (latestAnnouncement.type === "TRAIN_APPROACHING") audioManager.playTrainRumble(0.4, 2);
    if (latestAnnouncement.type === "TRAIN_DEPARTING") audioManager.playTrainRumble(0.5, 2.5);
    consumeAnnouncement();
    // Deferred a microtask so these setState calls are async, not synchronous within the effect
    // body (avoids react-hooks/set-state-in-effect) — same pattern as the station-switch effect below.
    Promise.resolve().then(() => setCaption(message || null));
    const timeout = window.setTimeout(() => setCaption((current) => (current === message ? null : current)), CAPTION_VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, [latestAnnouncement, consumeAnnouncement]);

  // Ambience/door/rumble sounds live on a module-level singleton so they survive this component
  // remounting on the next station — only stop the ambience loop and any in-flight speech here.
  useEffect(() => () => audioManager.leaveScene(), []);

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

  const gltfPath = useStationGLTFAvailability(station.code);

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
    <div className="relative h-full w-full overflow-hidden rounded-md bg-slate-950" onPointerDown={() => audioManager.ensureContext()}>
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 600 }} dpr={[1, 1.75]}>
        <Suspense fallback={null}>
          <color attach="background" args={["#0b1120"]} />
          <fog attach="fog" args={["#0b1120", 60, 220]} />
          <StationModel
            layout={layout}
            trains={trainVisuals}
            passengers={passengers}
            selectedTrainId={selectedTrainId}
            onSelectTrain={setSelectedTrainId}
          />
          <CameraController mode={cameraMode} layout={layout} trains={trainVisuals} resetToken={resetToken} />
        </Suspense>
      </Canvas>

      {!gltfPath && (
        <span className="pointer-events-none absolute left-3 top-3 rounded bg-slate-900/70 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
          Simulated procedural station — no asset for {station.code}
        </span>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="pointer-events-auto rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-50">{station.name}</h2>
            <span className="font-mono text-[11px] text-slate-500">{formatClockTime(clock.currentTime)}</span>
          </div>
          {selectedPlatform && (
            <p className="text-xs text-slate-400">
              Platform {selectedPlatform.platformNumber} · <span style={{ color: selectedPlatform.colorHex }}>{selectedPlatform.lineName}</span>
            </p>
          )}
          {selectedTrain ? (
            <div className="mt-2 space-y-0.5 text-xs text-slate-300">
              <p>
                Train: <span className="font-mono text-slate-100">{selectedTrain.code}</span>
              </p>
              <p>Destination: {selectedTrain.destinationStationName || "—"}</p>
              <p>Next station: {selectedTrain.nextStationName || "Terminus"}</p>
              <p>Occupancy: {formatOccupancyPercent(selectedTrain.passengerCount, selectedTrain.capacity)}</p>
              <p className={selectedTrain.delaySeconds > 0 ? "text-amber-400" : "text-emerald-400"}>
                Delay: {selectedTrain.delaySeconds > 0 ? `+${formatDurationSeconds(selectedTrain.delaySeconds)}` : "On time"}
              </p>
              {nextTrainCode && <p className="text-slate-500">Next train: {nextTrainCode}</p>}
              {selectedTrain.phase === "BOARDING" && (
                <p className="text-slate-400">
                  Doors open — {boardingCount} boarding · {alightingCount} alighting
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No train currently at this station.</p>
          )}
        </div>

        <div className="pointer-events-auto flex items-start gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAudioPanelOpen((open) => !open)}
              className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-200 shadow-xl backdrop-blur hover:bg-slate-800"
              aria-label="Audio settings"
            >
              {audioSettings.muted ? "🔇" : "🔊"}
            </button>
            {audioPanelOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 space-y-2 rounded-md border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur">
                <label className="flex items-center justify-between gap-2">
                  <span>Mute</span>
                  <input
                    type="checkbox"
                    checked={audioSettings.muted}
                    onChange={(e) => updateAudioSettings({ muted: e.target.checked })}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-14">Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioSettings.volume}
                    onChange={(e) => updateAudioSettings({ volume: Number(e.target.value) })}
                    className="flex-1 accent-sky-400"
                  />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Announcements</span>
                  <input
                    type="checkbox"
                    checked={audioSettings.announcementsEnabled}
                    onChange={(e) => updateAudioSettings({ announcementsEnabled: e.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Ambient audio</span>
                  <input
                    type="checkbox"
                    checked={audioSettings.ambienceEnabled}
                    onChange={(e) => updateAudioSettings({ ambienceEnabled: e.target.checked })}
                  />
                </label>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-200 shadow-xl backdrop-blur hover:bg-slate-800"
          >
            ← Network
          </button>
        </div>
      </div>

      {caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
          <div className="max-w-xl rounded-md bg-slate-900/85 px-3 py-1.5 text-center text-xs text-slate-100 shadow-lg backdrop-blur">
            {caption}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4">
        {trainVisuals.length > 1 && (
          <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5">
            {trainVisuals.map((t) => (
              <button
                key={t.trainId}
                type="button"
                onClick={() => setSelectedTrainId(t.trainId)}
                className={`rounded-full border px-2.5 py-1 text-xs font-mono transition-colors ${
                  t.trainId === selectedTrainId
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-slate-700 bg-slate-900/80 text-slate-400 hover:text-slate-100"
                }`}
              >
                {t.code}
              </button>
            ))}
          </div>
        )}

        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1.5 shadow-xl backdrop-blur">
          {CAMERA_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCameraMode(mode)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                cameraMode === mode ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-700" aria-hidden />
          <button
            type="button"
            onClick={() => setResetToken((t) => t + 1)}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            Reset Camera
          </button>
        </div>
      </div>
    </div>
  );
}

function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
