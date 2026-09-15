"use client";

import { useId, useMemo, useState } from "react";
import { CHART_CHROME } from "@/lib/analytics/palette";
import { useElementWidth } from "@/hooks/useElementWidth";

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

const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;
const MIN_WIDTH = 240;

/**
 * A hand-rolled multi-series SVG line chart — 2px lines, hairline recessive gridlines, a soft area
 * wash under each series, a hover crosshair + tooltip, and a legend only when there's more than one
 * series, per the dataviz skill's mark specs.
 *
 * The viewBox now matches the element's measured width 1:1. The previous fixed 800-unit viewBox
 * with `preserveAspectRatio="none"` stretched the coordinate space to whatever the card happened to
 * be, which is why every mark carried `vector-effect="non-scaling-stroke"` — correcting for a
 * distortion rather than not introducing one. Measuring removes the need for both.
 */
export function LineChart({ series, height = 200, xFormat, yFormat, emptyMessage }: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [containerRef, measuredWidth] = useElementWidth<HTMLDivElement>();
  const gradientId = useId();

  const width = Math.max(MIN_WIDTH, measuredWidth);
  const hasData = series.some((s) => s.points.length > 0);
  const reference = series.find((s) => s.points.length > 0)?.points ?? [];

  const { xMin, xMax, yMax, plotH, sx, sy } = useMemo(() => {
    const allPoints = series.flatMap((s) => s.points);
    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    const xMin = xs.length ? Math.min(...xs) : 0;
    const xMax = xs.length ? Math.max(...xs) : 1;
    const yMaxRaw = ys.length ? Math.max(...ys) : 1;
    const yMax = yMaxRaw <= 0 ? 1 : yMaxRaw * 1.15;
    const plotW = width - PAD_LEFT - PAD_RIGHT;
    const plotH = height - PAD_TOP - PAD_BOTTOM;
    const sx = (x: number) =>
      PAD_LEFT + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
    const sy = (y: number) => PAD_TOP + plotH - (y / yMax) * plotH;
    return { xMin, xMax, yMax, plotH, sx, sy };
  }, [series, height, width]);

  if (!hasData) {
    return (
      <div ref={containerRef} className="flex h-[160px] items-center justify-center text-xs text-muted">
        {emptyMessage ?? "No data yet for this range."}
      </div>
    );
  }

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const format = yFormat ?? ((y: number) => String(Math.round(y)));
  const xFmt = xFormat ?? ((x: number) => String(x));

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
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
  const baselineY = PAD_TOP + plotH;

  return (
    <div ref={containerRef} className="relative">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-secondary">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {measuredWidth > 0 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
          className="touch-none"
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`${gradientId}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {gridSteps.map((g) => {
            const y = PAD_TOP + plotH - g * plotH;
            return (
              <g key={g}>
                <line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={y}
                  y2={y}
                  stroke={CHART_CHROME.grid}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={CHART_CHROME.crosshair}
                  fontSize={10}
                >
                  {format(g * yMax)}
                </text>
              </g>
            );
          })}

          <line
            x1={PAD_LEFT}
            x2={width - PAD_RIGHT}
            y1={baselineY}
            y2={baselineY}
            stroke={CHART_CHROME.axis}
            strokeWidth={1}
          />

          <text x={PAD_LEFT} y={height - 4} textAnchor="start" fill={CHART_CHROME.crosshair} fontSize={10}>
            {xFmt(xMin)}
          </text>
          <text
            x={width - PAD_RIGHT}
            y={height - 4}
            textAnchor="end"
            fill={CHART_CHROME.crosshair}
            fontSize={10}
          >
            {xFmt(xMax)}
          </text>

          {series.map((s) => {
            if (s.points.length === 0) return null;
            const line = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");
            const first = s.points[0];
            const last = s.points[s.points.length - 1];
            if (!first || !last) return null;
            const area = `${line} L ${sx(last.x)} ${baselineY} L ${sx(first.x)} ${baselineY} Z`;
            return (
              <g key={s.key}>
                <path d={area} fill={`url(#${gradientId}-${s.key})`} />
                <path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle
                  cx={sx(last.x)}
                  cy={sy(last.y)}
                  r={3.5}
                  fill={s.color}
                  stroke={CHART_CHROME.halo}
                  strokeWidth={2}
                />
              </g>
            );
          })}

          {hovered && (
            <line
              x1={sx(hovered.x)}
              x2={sx(hovered.x)}
              y1={PAD_TOP}
              y2={baselineY}
              stroke={CHART_CHROME.crosshair}
              strokeWidth={1}
            />
          )}
          {hovered && hoverIndex != null &&
            series.map((s) => {
              const p = s.points[hoverIndex];
              if (!p) return null;
              return (
                <circle
                  key={s.key}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={3.5}
                  fill={s.color}
                  stroke={CHART_CHROME.halo}
                  strokeWidth={2}
                />
              );
            })}
        </svg>
      )}

      {hovered && hoverIndex != null && (
        <div
          className="pointer-events-none absolute top-1 rounded-md bg-surface-raised px-2 py-1.5 text-xs shadow-lg ring-1 ring-edge"
          style={{ left: `${Math.min(88, Math.max(0, (sx(hovered.x) / width) * 100))}%` }}
        >
          <div className="tabular mb-0.5 text-muted">{xFmt(hovered.x)}</div>
          {series.map((s) => {
            const p = s.points[hoverIndex];
            if (!p) return null;
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-content">
                <span
                  className="inline-block size-1.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                {series.length > 1 && <span className="text-secondary">{s.label}:</span>}
                <span className="tabular">{format(p.y)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
