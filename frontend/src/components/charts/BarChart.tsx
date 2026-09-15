"use client";

import { useState } from "react";
import { CHART_CHROME } from "@/lib/analytics/palette";
import { SURFACE_HEX } from "@/lib/ui/tone";
import { useElementWidth } from "@/hooks/useElementWidth";

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

const BAR_THICKNESS = 20;
const BAR_GAP = 6;
const MIN_WIDTH = 240;

function truncate(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
}

/**
 * A hand-rolled bar chart — ≤24px-thick bars with a 4px rounded data-end, a small surface gap
 * between neighbours, value-at-the-tip labels in neutral ink (never the bar's own colour), and a
 * per-bar tooltip in both orientations.
 *
 * Like LineChart, this renders at measured width rather than stretching a fixed viewBox, so bars
 * keep their intended thickness instead of being squashed or fattened by the container.
 */
export function BarChart({ data, orientation, valueFormat, height = 200 }: BarChartProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [containerRef, measuredWidth] = useElementWidth<HTMLDivElement>();
  const format = valueFormat ?? ((v: number) => String(Math.round(v)));
  const width = Math.max(MIN_WIDTH, measuredWidth);

  if (data.length === 0) {
    return (
      <div ref={containerRef} className="flex h-[120px] items-center justify-center text-xs text-muted">
        No data yet.
      </div>
    );
  }

  const maxValue = Math.max(1, ...data.map((d) => d.value));

  if (orientation === "vertical") {
    const padLeft = 12;
    const padRight = 12;
    const padTop = 18;
    const padBottom = 28;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const slot = plotW / data.length;
    const barW = Math.max(2, Math.min(24, slot - BAR_GAP));

    return (
      <div ref={containerRef}>
        {measuredWidth > 0 && (
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={padTop + plotH}
              y2={padTop + plotH}
              stroke={CHART_CHROME.axis}
              strokeWidth={1}
            />
            {data.map((d, i) => {
              const barH = (d.value / maxValue) * plotH;
              const x = padLeft + i * slot + (slot - barW) / 2;
              const y = padTop + plotH - barH;
              const isHover = hoverKey === d.key;
              return (
                <g
                  key={d.key}
                  onPointerEnter={() => setHoverKey(d.key)}
                  onPointerLeave={() => setHoverKey(null)}
                >
                  {/* Both orientations carry a tooltip now — the vertical branch previously tracked
                      hover only to change opacity, which told a mouse user nothing. */}
                  <title>{`${d.label}: ${format(d.value)}`}</title>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(1, barH)}
                    rx={4}
                    fill={d.color}
                    opacity={isHover ? 1 : 0.85}
                  />
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill={SURFACE_HEX.secondary}
                    fontSize={11}
                  >
                    {format(d.value)}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={height - 8}
                    textAnchor="middle"
                    fill={CHART_CHROME.crosshair}
                    fontSize={10}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    );
  }

  // Horizontal: one row per datum, sorted by the caller, label on the left, bar + value to the right.
  // labelW is sized for this app's longest real station name ("Majestic (Kempegowda)"); truncate()
  // is the fallback for anything longer than that still fitting the reserved column rather than
  // running past x=0 and getting clipped by the viewBox.
  const rowH = BAR_THICKNESS + BAR_GAP;
  const chartHeight = data.length * rowH + 8;
  const labelW = Math.min(170, Math.max(90, width * 0.32));
  const padRight = 48;
  const plotW = Math.max(20, width - labelW - padRight);

  return (
    <div ref={containerRef} className="scroll-thin overflow-y-auto" style={{ maxHeight: 420 }}>
      {measuredWidth > 0 && (
        <svg viewBox={`0 0 ${width} ${chartHeight}`} width="100%" height={chartHeight}>
          {data.map((d, i) => {
            const barW = Math.max(2, (d.value / maxValue) * plotW);
            const y = 4 + i * rowH;
            const isHover = hoverKey === d.key;
            return (
              <g
                key={d.key}
                onPointerEnter={() => setHoverKey(d.key)}
                onPointerLeave={() => setHoverKey(null)}
              >
                <title>{`${d.label}: ${format(d.value)}`}</title>
                <text
                  x={labelW - 8}
                  y={y + BAR_THICKNESS / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={SURFACE_HEX.secondary}
                  fontSize={11}
                >
                  {truncate(d.label, 26)}
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={barW}
                  height={BAR_THICKNESS}
                  rx={4}
                  fill={d.color}
                  opacity={isHover ? 1 : 0.85}
                />
                <text
                  x={labelW + barW + 6}
                  y={y + BAR_THICKNESS / 2}
                  dominantBaseline="middle"
                  fill={SURFACE_HEX.secondary}
                  fontSize={11}
                >
                  {format(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
