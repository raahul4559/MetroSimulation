"use client";

import { useState } from "react";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Resolved hex. Callers doing status/severity encoding (e.g. congestion level) pass a status
   * color here; callers doing plain magnitude comparison pass the sequential/categorical hue. */
  color: string;
}

interface BarChartProps {
  data: BarDatum[];
  orientation: "horizontal" | "vertical";
  valueFormat?: (v: number) => string;
  /** Vertical only — fixed plot height. Horizontal derives its height from row count. */
  height?: number;
}

const WIDTH = 800;
const BAR_THICKNESS = 20;
const BAR_GAP = 6;

function truncate(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
}

/** A hand-rolled bar chart — ≤24px-thick bars with a 4px rounded data-end, a 2px surface gap
 * between neighbors, value-at-the-tip labels in neutral ink (never the bar's own color), and a
 * per-bar hover tooltip. */
export function BarChart({ data, orientation, valueFormat, height = 200 }: BarChartProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const format = valueFormat ?? ((v: number) => String(Math.round(v)));

  if (data.length === 0) {
    return <div className="flex h-[120px] items-center justify-center text-xs text-slate-600">No data yet.</div>;
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));

  if (orientation === "vertical") {
    const padLeft = 36;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 28;
    const plotW = WIDTH - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const slot = plotW / data.length;
    const barW = Math.min(24, slot - BAR_GAP);

    return (
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <line x1={padLeft} x2={WIDTH - padRight} y1={padTop + plotH} y2={padTop + plotH} stroke="#334155" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const barH = (d.value / maxValue) * plotH;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const y = padTop + plotH - barH;
          const isHover = hoverKey === d.key;
          return (
            <g key={d.key} onPointerEnter={() => setHoverKey(d.key)} onPointerLeave={() => setHoverKey(null)}>
              <rect x={x} y={y} width={barW} height={Math.max(1, barH)} rx={4} fill={d.color} opacity={isHover ? 1 : 0.9} />
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-slate-300" fontSize={11}>
                {format(d.value)}
              </text>
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fill-slate-500" fontSize={10}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // Horizontal: one row per datum, sorted by the caller, label on the left, bar + value to the right.
  // labelW is sized for this app's longest real station name ("Majestic (Kempegowda)"); truncate()
  // is the fallback for anything longer than that still fitting the reserved column rather than
  // running past x=0 and getting clipped by the viewBox.
  const rowH = BAR_THICKNESS + BAR_GAP;
  const chartHeight = data.length * rowH + 8;
  const labelW = 170;
  const padRight = 48;
  const plotW = WIDTH - labelW - padRight;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${chartHeight}`} width="100%" height={Math.min(chartHeight, 420)} preserveAspectRatio="xMinYMin meet">
      {data.map((d, i) => {
        const barW = Math.max(2, (d.value / maxValue) * plotW);
        const y = 4 + i * rowH;
        const isHover = hoverKey === d.key;
        return (
          <g key={d.key} onPointerEnter={() => setHoverKey(d.key)} onPointerLeave={() => setHoverKey(null)}>
            <title>{`${d.label}: ${format(d.value)}`}</title>
            <text x={labelW - 8} y={y + BAR_THICKNESS / 2} textAnchor="end" dominantBaseline="middle" className="fill-slate-400" fontSize={11}>
              {truncate(d.label, 26)}
            </text>
            <rect x={labelW} y={y} width={barW} height={BAR_THICKNESS} rx={4} fill={d.color} opacity={isHover ? 1 : 0.9} />
            <text x={labelW + barW + 6} y={y + BAR_THICKNESS / 2} dominantBaseline="middle" className="fill-slate-300" fontSize={11}>
              {format(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
