"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Volume2, VolumeX } from "lucide-react";
import type { Station } from "@/domain/metro";
import type { CameraMode3D, PlatformLayout3D, TrainVisual3D } from "@/domain/station3d";
import type { StationConfig, StationModelQuality } from "@/domain/stationConfig";
import type { StationVisualReference } from "@/domain/stationVisualReference";
import type { AnnouncementCaption } from "@/lib/announcements/AnnouncementService";
import { cn } from "@/lib/ui/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Surface } from "@/components/ui/Surface";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { useDataState } from "@/hooks/useDataState";
import { useMapPreferences } from "@/hooks/useMapPreferences";
import { AudioSettingsControls } from "@/components/layout/AudioSettingsControls";
import { DataStateBadge } from "@/components/realtime/DataStateBadge";
import { RealtimeDiagnostics } from "@/components/realtime/RealtimeDiagnostics";
import { useNetworkData, useSimulationData } from "@/providers/SimulationProvider";
import { getStationArrivals } from "@/lib/metro/stationArrivals";
import { describeTrainDataState } from "@/lib/realtime/dataState";
import { lineVividColor } from "@/lib/ui/lineColor";
import { AnnouncementIndicator } from "./AnnouncementIndicator";
import { CameraControls } from "./CameraControls";
import { ReferencePanel } from "./ReferencePanel";
import { TrainInfoCard } from "./TrainInfoCard";

const QUALITY_LABEL: Record<StationModelQuality, string> = {
  HIGH: "High fidelity",
  RECONSTRUCTED: "Simplified reconstruction",
  PROCEDURAL: "Procedural fallback",
};

interface Station3DOverlayProps {
  station: Station;
  config: StationConfig;
  quality: StationModelQuality;
  cameraMode: CameraMode3D;
  onCameraModeChange: (mode: CameraMode3D) => void;
  onResetCamera: () => void;
  onBack: () => void;
  caption: AnnouncementCaption | null;
  reference: StationVisualReference | null;
  train: TrainVisual3D | null;
  platform: PlatformLayout3D | undefined;
  trains: readonly TrainVisual3D[];
  selectedTrainId: number | null;
  onSelectTrain: (id: number) => void;
  /** Suppresses the whole overlay while a transition covers the scene. */
  hidden?: boolean;
}

/**
 * Every piece of HTML chrome laid over the 3D station.
 *
 * Extracted from `StationScene`, which had all five overlays inline and had grown past 400 lines
 * with the WebGL scene, the announcement lifecycle and the audio lifecycle sharing the file. The
 * scene component now owns behaviour; this owns presentation.
 *
 * Minimal on purpose — the station is the content. Identity, exit and the data state top-left;
 * utilities top-right; camera on the right rail; one small train card bottom-left; captions
 * bottom-centre. The IST clock and service status stay visible in the status bar above. Everything is
 * `pointer-events-none` at the container level with `pointer-events-auto` on the interactive
 * children, so the operator can still orbit the scene by dragging anywhere between the controls.
 */
export function Station3DOverlay({
  station,
  config,
  quality,
  cameraMode,
  onCameraModeChange,
  onResetCamera,
  onBack,
  caption,
  reference,
  train,
  platform,
  trains,
  selectedTrainId,
  onSelectTrain,
  hidden = false,
}: Station3DOverlayProps) {
  // Server-derived: LIVE only for a fresh observed feed still reaching this browser.
  const { network, nowMs } = useDataState();
  const { trains: canonicalTrains, state } = useSimulationData();
  const { lines, tracks } = useNetworkData();
  const [preferences] = useMapPreferences();
  const [audioOpen, setAudioOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [audioSettings] = useAudioSettings();

  const servingLines = useMemo(() => lines.filter((l) => station.lines.includes(l.code)), [lines, station.lines]);
  // The ETA and data state come from the canonical train, the same object the 2D map reads.
  const canonicalTrain = train ? canonicalTrains.find((t) => t.id === train.trainId) ?? null : null;
  const arrival = canonicalTrain
    ? (getStationArrivals(station, [canonicalTrain], tracks, lines, state?.serverEpochMillis)[0] ?? null)
    : null;
  const trainDataState = network && canonicalTrain ? describeTrainDataState(canonicalTrain, network, nowMs) : network;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity duration-(--duration-base)",
        hidden && "opacity-0",
      )}
      aria-hidden={hidden}
      inert={hidden}
    >
      {/* Identity, exit and data state */}
      <div className="absolute left-3 top-3 flex max-w-[min(20rem,60vw)] flex-col sm:left-4 sm:top-4">
        <Surface variant="overlay" padding="none" className="pointer-events-auto px-3.5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex items-center gap-1 rounded px-1 text-xs text-secondary transition-colors duration-(--duration-fast) hover:text-content"
          >
            <ArrowLeft size={13} aria-hidden />
            Network
          </button>
          <h2 className="mt-2 truncate text-lg font-semibold uppercase tracking-[0.06em] text-content">
            {station.name}
          </h2>
          <p className="mt-0.5 truncate text-xs">
            {servingLines.map((line, i) => (
              <span key={line.code}>
                {i > 0 && <span className="text-muted"> + </span>}
                <span style={{ color: lineVividColor(line) }}>{line.name.replace(/ Line$/, "")}</span>
              </span>
            ))}
            {config.isInterchange && <span className="text-muted"> · Interchange</span>}
          </p>
          <div className="mt-2.5">
            <DataStateBadge state={network} />
          </div>
        </Surface>
        {preferences.diagnosticsVisible && (
          <Surface variant="overlay" padding="sm" className="pointer-events-auto mt-2 w-64">
            <RealtimeDiagnostics variant="overlay" />
          </Surface>
        )}
      </div>

      {/* Utilities */}
      <div className="absolute right-3 top-3 flex items-start gap-1.5 sm:right-4 sm:top-4">
        {reference && (
          <div className="pointer-events-auto relative">
            <IconButton
              label="Reference sources"
              icon={<FileText size={16} />}
              variant="overlay"
              size="sm"
              active={referenceOpen}
              tooltipSide="bottom"
              onClick={() => setReferenceOpen((v) => !v)}
            />
            {referenceOpen && (
              <div className="absolute right-0 top-full mt-2">
                <ReferencePanel reference={reference} onClose={() => setReferenceOpen(false)} />
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-auto relative">
          <IconButton
            label={audioSettings.muted ? "Audio (muted)" : "Audio settings"}
            icon={audioSettings.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            variant="overlay"
            size="sm"
            active={audioOpen}
            tooltipSide="bottom"
            onClick={() => setAudioOpen((v) => !v)}
          />
          {audioOpen && (
            <Surface
              variant="overlay"
              padding="sm"
              className="absolute right-0 top-full mt-2 w-64 motion-safe:animate-[panel-in_var(--duration-fast)_var(--ease-out)]"
            >
              <AudioSettingsControls />
            </Surface>
          )}
        </div>
      </div>

      {/* Camera rail */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-4">
        <CameraControls mode={cameraMode} onModeChange={onCameraModeChange} onReset={onResetCamera} />
      </div>

      {/* Train card, bottom-left */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
        <TrainInfoCard
          train={train}
          platform={platform}
          arrival={arrival}
          dataState={trainDataState}
          trains={trains}
          selectedTrainId={selectedTrainId}
          onSelectTrain={onSelectTrain}
        />
      </div>

      {/* Announcement caption, bottom-centre — clear of the train card on wide screens, above it on
          narrow ones. */}
      {caption && (
        <div className="absolute inset-x-0 bottom-48 flex justify-center px-3 md:bottom-4 md:left-80">
          <AnnouncementIndicator caption={caption} />
        </div>
      )}

      {/* Fidelity disclosure. Small and out of the way, but never hidden — the geometry is an
          approximation and the interface says so rather than implying a survey-accurate model. */}
      <span className="pointer-events-none absolute bottom-3 right-3 hidden text-[10px] uppercase tracking-wider text-muted lg:block">
        {QUALITY_LABEL[quality]}
      </span>
    </div>
  );
}
