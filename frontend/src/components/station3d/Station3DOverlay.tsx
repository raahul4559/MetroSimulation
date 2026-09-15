"use client";

import { useState } from "react";
import { ArrowLeft, FileText, Volume2, VolumeX } from "lucide-react";
import type { Station } from "@/domain/metro";
import type { CameraMode3D, PlatformLayout3D, TrainVisual3D } from "@/domain/station3d";
import type { StationConfig, StationModelQuality } from "@/domain/stationConfig";
import type { StationVisualReference } from "@/domain/stationVisualReference";
import type { AnnouncementCaption } from "@/lib/announcements/AnnouncementService";
import { cn } from "@/lib/ui/cn";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Surface } from "@/components/ui/Surface";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { AudioSettingsControls } from "@/components/layout/AudioSettingsControls";
import { AnnouncementIndicator } from "./AnnouncementIndicator";
import { CameraControls } from "./CameraControls";
import { ReferencePanel } from "./ReferencePanel";
import { TrainInfoBar } from "./TrainInfoBar";

const QUALITY_LABEL: Record<StationModelQuality, string> = {
  HIGH: "High fidelity",
  RECONSTRUCTED: "Simplified reconstruction",
  PROCEDURAL: "Procedural fallback",
};

interface Station3DOverlayProps {
  station: Station;
  config: StationConfig;
  quality: StationModelQuality;
  platformLabel: string | null;
  clockTime: string;
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
  nextTrainCode: string | null;
  boardingCount: number;
  alightingCount: number;
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
 * The layout follows the brief's shape: identity and exit top-left, utilities top-right, camera on
 * the right rail, train information along the bottom, captions floating above it. Everything is
 * `pointer-events-none` at the container level with `pointer-events-auto` on the interactive
 * children, so the operator can still orbit the scene by dragging anywhere between the controls.
 */
export function Station3DOverlay({
  station,
  config,
  quality,
  platformLabel,
  clockTime,
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
  nextTrainCode,
  boardingCount,
  alightingCount,
  hidden = false,
}: Station3DOverlayProps) {
  const [audioOpen, setAudioOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [audioSettings] = useAudioSettings();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity duration-(--duration-base)",
        hidden && "opacity-0",
      )}
      aria-hidden={hidden}
      inert={hidden}
    >
      {/* Identity + exit */}
      <div className="absolute left-3 top-3 flex max-w-[min(22rem,60vw)] flex-col gap-2 sm:left-4 sm:top-4">
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={onBack}
          className="pointer-events-auto w-fit bg-surface/80 backdrop-blur-xl"
        >
          Back to Network
        </Button>

        <Surface variant="overlay" padding="none" className="pointer-events-auto px-3.5 py-2.5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="truncate text-base font-semibold tracking-tight text-content">
              {station.name}
            </h2>
            <span className="tabular shrink-0 font-mono text-[11px] text-muted">{clockTime}</span>
          </div>
          {platformLabel && <p className="mt-0.5 truncate text-[11px] text-secondary">{platformLabel}</p>}
          <div className="mt-2 flex items-center gap-2">
            <StatusIndicator label="Live" tone="positive" />
            <span className="text-[10px] uppercase tracking-wider text-muted">
              {config.buildType.replace("_", " ")}
              {config.isInterchange ? " · Interchange" : ""}
            </span>
          </div>
        </Surface>
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

      {/* Caption + train bar */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 sm:p-4">
        {caption && <AnnouncementIndicator caption={caption} />}
        <TrainInfoBar
          train={train}
          platform={platform}
          nextTrainCode={nextTrainCode}
          boardingCount={boardingCount}
          alightingCount={alightingCount}
          trains={trains}
          selectedTrainId={selectedTrainId}
          onSelectTrain={onSelectTrain}
        />
      </div>

      {/* Fidelity disclosure. Small and out of the way, but never hidden — the geometry is an
          approximation and the interface says so rather than implying a survey-accurate model. */}
      <span className="pointer-events-none absolute bottom-3 left-3 hidden text-[10px] uppercase tracking-wider text-muted lg:block">
        {QUALITY_LABEL[quality]}
      </span>
    </div>
  );
}
