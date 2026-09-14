import type { Line } from "@/domain/metro";

interface MapControlsProps {
  lines: readonly Line[];
  hiddenLineCodes: ReadonlySet<string>;
  onToggleLine: (code: string) => void;
  labelsVisible: boolean;
  onToggleLabels: () => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitNetwork: () => void;
}

const ICON_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors";

/**
 * Floating toolbar over the map: zoom/pan controls plus line and label visibility toggles.
 * Purely presentational — all toggle/zoom state is owned by the caller's hooks.
 */
export function MapControls({
  lines,
  hiddenLineCodes,
  onToggleLine,
  labelsVisible,
  onToggleLabels,
  scale,
  onZoomIn,
  onZoomOut,
  onFitNetwork,
}: MapControlsProps) {
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
      <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 backdrop-blur">
        {lines.map((line) => {
          const hidden = hiddenLineCodes.has(line.code);
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => onToggleLine(line.code)}
              aria-pressed={!hidden}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                hidden ? "text-slate-500 hover:bg-slate-800" : "text-slate-100 hover:bg-slate-800"
              }`}
              title={hidden ? `Show ${line.name}` : `Hide ${line.name}`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: line.colorHex, opacity: hidden ? 0.3 : 1 }}
                aria-hidden
              />
              <span className={hidden ? "line-through" : undefined}>{line.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onToggleLabels}
          aria-pressed={labelsVisible}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
          title={labelsVisible ? "Hide station labels" : "Show station labels"}
        >
          {labelsVisible ? "Labels: On" : "Labels: Off"}
        </button>
      </div>

      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 p-1.5 backdrop-blur">
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={ICON_BUTTON}>
          −
        </button>
        <span className="w-10 text-center text-xs text-slate-400">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={ICON_BUTTON}>
          +
        </button>
        <button
          type="button"
          onClick={onFitNetwork}
          className="ml-1 rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
          title="Fit entire network in view"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
