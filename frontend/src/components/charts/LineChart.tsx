"use client";

import { useMemo, useState } from "react";

export interface LineSeries {
  key: string;
  label: string;
  /** Resolved hex — a categorical slot from the dataviz palette, assigned by the caller in a fixed
   * order (never cycled/generated), per the dataviz skill's color-formula. */
  color: string;
  points: { x: number; y: number }[];
}

interface LineChartProps {
  series: LineSeries[];
  height?: number;
  xFormat?: (x: number) => string;
  yFormat?: (y: number) => string;
  emptyMessage?: string;
}

const WIDTH = 800;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

/** A hand-rolled multi-series SVG line chart — 2px lines, hairline recessive gridlines, a hover
 * crosshair + tooltip, and a legend only when there's more than one series — per the dataviz
 * skill's mark specs. `vector-effect="non-scaling-stroke"` keeps stroke widths a true 2px on
 * screen regardless of how the wide internal viewBox gets scaled to the card's actual width. */
export function LineChart({ series, height = 200, xFormat, yFormat, emptyMessage }: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const hasData = series.some((s) => s.points.length > 0);
  const reference = series.find((s) => s.points.length > 0)?.points ?? [];

  const { xMin, xMax, yMax, plotW, plotH, sx, sy } = useMemo(() => {
    const allPoints = series.flatMap((s) => s.points);
    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    const xMin = xs.length ? Math.min(...xs) : 0;
    const xMax = xs.length ? Math.max(...xs) : 1;
    const yMaxRaw = ys.length ? Math.max(...ys) : 1;
    const yMax = yMaxRaw <= 0 ? 1 : yMaxRaw * 1.15;
    const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = height - PAD_TOP - PAD_BOTTOM;
    const sx = (x: number) => PAD_LEFT + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
    const sy = (y: number) => PAD_TOP + plotH - (y / yMax) * plotH;
    return { xMin, xMax, yMax, plotW, plotH, sx, sy };
  }, [series, height]);

  if (!hasData) {
    return (
      <div className="flex h-[160px] items-center justify-center text-xs text-slate-600">
        {emptyMessage ?? "No data yet for this range."}
      </div>
    );
  }

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const format = yFormat ?? ((y: number) => String(Math.round(y)));
  const xFmt = xFormat ?? ((x: number) => String(x));

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    if (reference.length === 0) return;
    let nearest = 0;
    let best = Infinity;
    reference.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex != null ? reference[hoverIndex] : null;

  return (
    <div className="relative">
      {series.length > 1 && (
        <div className="mb-1 flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
        className="touch-none"
      >
        {gridSteps.map((g) => {
          const y = PAD_TOP + plotH - g * plotH;
          return (
            <g key={g}>
              <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={PAD_LEFT - 6} y={y} textAnchor="end" dominantBaseline="middle" className="fill-slate-500" fontSize={10}>
                {format(g * yMax)}
              </text>
            </g>
          );
        })}
        <line x1={PAD_LEFT} x2={PAD_LEFT} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="#334155" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke="#334155" strokeWidth={1} vectorEffect="non-scaling-stroke" />

        <text x={PAD_LEFT} y={height - 4} textAnchor="start" className="fill-slate-600" fontSize={10}>
          {xFmt(xMin)}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={height - 4} textAnchor="end" className="fill-slate-600" fontSize={10}>
          {xFmt(xMax)}
        </text>

        {series.map((s) => {
          if (s.points.length === 0) return null;
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={sx(last.x)} cy={sy(last.y)} r={4} fill={s.color} stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}

        {hovered && (
          <line
            x1={sx(hovered.x)}
            x2={sx(hovered.x)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="#475569"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {hovered &&
          series.map((s) => {
            const p = s.points[hoverIndex!];
            if (!p) return null;
            return (
              <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={s.color} stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            );
          })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-slate-700 bg-slate-950/95 px-2 py-1 text-xs shadow-lg"
          style={{
            left: `${Math.min(88, Math.max(0, (sx(hovered.x) / WIDTH) * 100))}%`,
          }}
        >
          <div className="mb-0.5 text-slate-500">{xFmt(hovered.x)}</div>
          {series.map((s) => {
            const p = s.points[hoverIndex!];
            if (!p) return null;
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-slate-200">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {series.length > 1 && <span className="text-slate-400">{s.label}:</span>}
                <span>{format(p.y)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
