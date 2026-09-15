"use client";

import { useMemo } from "react";
import type { Line, Track } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import { computeHeadways, headwayTone } from "@/lib/metro/headway";
import { formatDurationSeconds } from "@/lib/metro/passengerDisplay";
import { LineBadge } from "@/components/ui/LineBadge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

interface HeadwayPanelProps {
  trains: readonly TrainState[];
  lines: readonly Line[];
  tracks: readonly Track[];
}

const DIRECTION_LABEL = { OUTBOUND: "Outbound", INBOUND: "Inbound" } as const;

/**
 * Observed spacing between trains, per line and direction.
 *
 * "Average" is the headway passengers are actually getting; "shortest" and "longest" are where it
 * breaks down — two trains bunched behind one delay leave a long gap somewhere behind them, and
 * that gap is what a waiting passenger experiences. See `lib/metro/headway` for how it is derived
 * from state the engine already publishes.
 */
export function HeadwayPanel({ trains, lines, tracks }: HeadwayPanelProps) {
  const segments = useMemo(() => computeHeadways(trains, lines, tracks), [trains, lines, tracks]);

  if (segments.length === 0) {
    return <p className="text-xs text-muted">No trains in service.</p>;
  }

  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead>
          <tr className="text-muted">
            <th className="border-b border-edge pb-2 pr-3 font-medium">Line</th>
            <th className="border-b border-edge pb-2 pr-3 font-medium">Direction</th>
            <th className="border-b border-edge pb-2 pr-3 text-right font-medium">Trains</th>
            <th className="border-b border-edge pb-2 pr-3 text-right font-medium">Average</th>
            <th className="border-b border-edge pb-2 pr-3 text-right font-medium">Shortest</th>
            <th className="border-b border-edge pb-2 pr-3 text-right font-medium">Longest</th>
            <th className="border-b border-edge pb-2 font-medium">Regularity</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {segments.map((segment) => (
            <tr
              key={`${segment.line.code}-${segment.direction}`}
              className="border-b border-divider text-secondary"
            >
              <td className="py-2 pr-3">
                <LineBadge line={segment.line} variant="dot" />
                <span className="ml-2">{segment.line.name}</span>
              </td>
              <td className="py-2 pr-3">{DIRECTION_LABEL[segment.direction]}</td>
              <td className="py-2 pr-3 text-right">{segment.trainCount}</td>
              <td className="py-2 pr-3 text-right text-content">
                {segment.gapsSeconds.length > 0 ? formatDurationSeconds(segment.averageSeconds) : "—"}
              </td>
              <td className="py-2 pr-3 text-right">
                {segment.gapsSeconds.length > 0 ? formatDurationSeconds(segment.minSeconds) : "—"}
              </td>
              <td className="py-2 pr-3 text-right">
                {segment.gapsSeconds.length > 0 ? formatDurationSeconds(segment.maxSeconds) : "—"}
              </td>
              <td className="py-2">
                {segment.gapsSeconds.length > 0 ? (
                  <StatusIndicator
                    label={headwayTone(segment) === "positive" ? "Even" : "Uneven"}
                    tone={headwayTone(segment)}
                  />
                ) : (
                  <span className="text-muted">Too few trains</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
