"use client";

import { useEffect, useMemo, useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { TimeRangePicker } from "./TimeRangePicker";
import { KindBadge } from "./KindBadge";
import { StatTile } from "@/components/charts/StatTile";
import {
  avgDelayTone,
  maxDelayTone,
  onTimeTone,
  zeroIsGoodTone,
} from "@/lib/analytics/thresholds";
import { ChartCard } from "@/components/charts/ChartCard";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { CHART_COLORS, congestionColor, waitBucketColor } from "@/lib/analytics/palette";
import { formatCount, formatElapsed, formatPct, formatSeconds, formatSpeed } from "@/lib/analytics/format";
import type { AnalyticsRange, CongestionLevel } from "@/domain/trainsim/analytics";

const CONGESTION_LABEL: Record<CongestionLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

/** Tinted chip in the congestion colour. `color-mix` keeps the tint tied to the one source colour
 * instead of the old trick of appending "22" to the hex to fake an alpha channel. */
function congestionChipStyle(level: CongestionLevel): React.CSSProperties {
  const color = congestionColor(level);
  return {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
    // ring-1 ring-inset picks its colour up from here.
    "--tw-ring-color": `color-mix(in srgb, ${color} 28%, transparent)`,
  } as React.CSSProperties;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<AnalyticsRange>("FULL");
  // Left empty until we know the simulation's own clock (seeded below) — defaulting to wall-clock
  // "now" would almost always fall outside the simulated range, since the sim clock runs on its own
  // configured start time, not real time.
  const [customFromLocal, setCustomFromLocal] = useState("");
  const [customToLocal, setCustomToLocal] = useState("");

  const customFrom = customFromLocal ? new Date(customFromLocal).toISOString() : undefined;
  const customTo = customToLocal ? new Date(customToLocal).toISOString() : undefined;

  const { data, isLoading, error } = useAnalytics(range, customFrom, customTo);

  useEffect(() => {
    if (range !== "CUSTOM" || customFromLocal || customToLocal || !data) return;
    // Deferred a microtask so this setState is async, not synchronous within the effect body
    // (avoids react-hooks/set-state-in-effect) — see the same pattern in useAnalytics.
    const simTime = data.meta.generatedAtSimTime;
    Promise.resolve().then(() => {
      const to = new Date(simTime);
      const from = new Date(to.getTime() - 3600_000);
      setCustomFromLocal(toLocalInputValue(from));
      setCustomToLocal(toLocalInputValue(to));
    });
  }, [range, data, customFromLocal, customToLocal]);

  const congestionBars = useMemo(() => {
    if (!data) return [];
    return [...data.live.stations]
      .sort((a, b) => b.currentQueue - a.currentQueue)
      .map((s) => ({ key: String(s.stationId), label: s.name, value: s.currentQueue, color: congestionColor(s.congestionLevel) }));
  }, [data]);

  const waitBars = useMemo(() => {
    if (!data) return [];
    return data.live.passengerWaitHistogram.map((b, i) => ({
      key: b.label,
      label: b.label,
      value: b.passengerCount,
      color: waitBucketColor(i),
    }));
  }, [data]);

  /** Indexed once rather than re-scanned per row — the table renders every station in the network
   *  and the previous `live.stations.find()` inside the row map made it quadratic. */
  const liveStationById = useMemo(
    () => new Map((data?.live.stations ?? []).map((s) => [s.stationId, s])),
    [data],
  );

  const stationRows = useMemo(() => {
    if (!data) return [];
    return [...data.simulationResult.stations].sort((a, b) => b.throughput - a.throughput);
  }, [data]);

  if (isLoading && !data) {
    return <p className="text-sm text-muted">Loading analytics…</p>;
  }
  if (error && !data) {
    return <p className="text-sm text-danger">{error}</p>;
  }
  if (!data) {
    return null;
  }

  const { live, simulationResult, historical, meta } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TimeRangePicker
          range={range}
          onRangeChange={setRange}
          customFromLocal={customFromLocal}
          customToLocal={customToLocal}
          onCustomFromChange={setCustomFromLocal}
          onCustomToChange={setCustomToLocal}
        />
        <p className="tabular text-xs text-muted">
          Sim time{" "}
          <span className="text-secondary">{new Date(meta.generatedAtSimTime).toLocaleString()}</span> ·
          tick {formatCount(meta.generatedAtTick)}
        </p>
      </div>
      <p className="text-xs text-muted">
        <KindBadge kind="LIVE" /> reflects this instant, always — the range picker only scopes{" "}
        <KindBadge kind="SIMULATION_RESULT" /> totals and <KindBadge kind="HISTORICAL" /> charts below.
      </p>
      {error && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning ring-1 ring-inset ring-warning/25">
          Last refresh failed: {error} — showing last known data.
        </p>
      )}

      {/* ---- Network ---- */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Network</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile label="Active trains" value={formatCount(live.network.activeTrains)} sublabel="LIVE" />
          <StatTile label="Active stations" value={formatCount(live.network.activeStations)} sublabel="LIVE" />
          <StatTile label="Network utilization (now)" value={formatPct(live.network.networkUtilizationPct)} sublabel="LIVE" />
          <StatTile
            label="Network utilization (range avg)"
            value={formatPct(simulationResult.network.avgNetworkUtilizationPct)}
            sublabel="SIMULATION RESULT"
          />
          <StatTile
            label="Active disruptions"
            value={formatCount(live.network.activeDisruptions)}
            sublabel="LIVE — why delays are happening"
            tone={zeroIsGoodTone(live.network.activeDisruptions)}
          />
        </div>
      </section>

      {/* ---- Trains ---- */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Trains</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          <StatTile label="Avg speed (now)" value={formatSpeed(live.trains.avgSpeedKmph)} sublabel="LIVE" />
          <StatTile
            label="Avg delay (now)"
            value={formatSeconds(live.trains.currentAvgDelaySeconds)}
            sublabel="LIVE"
            tone={avgDelayTone(live.trains.currentAvgDelaySeconds)}
          />
          <StatTile
            label="Max delay (now)"
            value={formatSeconds(live.trains.currentMaxDelaySeconds)}
            sublabel="LIVE"
            tone={maxDelayTone(live.trains.currentMaxDelaySeconds)}
          />
          <StatTile label="Utilization (now)" value={formatPct(live.trains.trainUtilizationPct)} sublabel="LIVE" />
          <StatTile
            label="On-time %"
            value={formatPct(simulationResult.trains.onTimePct)}
            sublabel="SIMULATION RESULT"
            tone={onTimeTone(simulationResult.trains.onTimePct)}
          />
          <StatTile label="Avg speed (range)" value={formatSpeed(simulationResult.trains.avgSpeedKmph)} sublabel="SIMULATION RESULT" />
          <StatTile label="Avg delay (range)" value={formatSeconds(simulationResult.trains.avgDelaySeconds)} sublabel="SIMULATION RESULT" />
          <StatTile label="Max delay (range)" value={formatSeconds(simulationResult.trains.maxDelaySeconds)} sublabel="SIMULATION RESULT" />
          <StatTile label="Utilization (range)" value={formatPct(simulationResult.trains.avgUtilizationPct)} sublabel="SIMULATION RESULT" />
        </div>
      </section>

      {/* ---- Passengers ---- */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Passengers</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <StatTile label="Total generated" value={formatCount(simulationResult.passengers.totalGenerated)} sublabel="SIMULATION RESULT" />
          <StatTile label="Total completed" value={formatCount(simulationResult.passengers.totalCompleted)} sublabel="SIMULATION RESULT" />
          <StatTile label="Avg waiting time" value={formatSeconds(simulationResult.passengers.avgWaitingSeconds)} sublabel="SIMULATION RESULT" />
          <StatTile label="Avg journey time" value={formatSeconds(simulationResult.passengers.avgJourneySeconds)} sublabel="SIMULATION RESULT" />
          <StatTile label="Avg occupancy (now)" value={formatPct(live.currentAvgOccupancyPct)} sublabel="LIVE" />
          <StatTile
            label="Unable to board"
            value={formatCount(simulationResult.passengers.unableToBoard)}
            sublabel="SIMULATION RESULT"
            tone={zeroIsGoodTone(simulationResult.passengers.unableToBoard)}
          />
        </div>
      </section>

      {/* ---- Charts ---- */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">Charts</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Passenger demand over time"
            subtitle={`Riders generated per ~${Math.round(historical.bucketSeconds / 60)}-min bucket`}
            kind="HISTORICAL"
            tableHeaders={["Time", "Generated"]}
            tableRows={historical.passengerDemand.map((p) => [formatElapsed(p.elapsedSimulationSeconds), formatCount(p.value)])}
          >
            <LineChart
              series={[
                {
                  key: "demand",
                  label: "Generated",
                  color: CHART_COLORS.seriesPrimary,
                  points: historical.passengerDemand.map((p) => ({ x: p.elapsedSimulationSeconds, y: p.value })),
                },
              ]}
              xFormat={formatElapsed}
              yFormat={(v) => formatCount(v)}
            />
          </ChartCard>

          <ChartCard
            title="Train occupancy over time"
            subtitle="Average passenger load across active trains, per bucket"
            kind="HISTORICAL"
            tableHeaders={["Time", "Occupancy"]}
            tableRows={historical.trainOccupancyPct.map((p) => [formatElapsed(p.elapsedSimulationSeconds), formatPct(p.value)])}
          >
            <LineChart
              series={[
                {
                  key: "occupancy",
                  label: "Occupancy",
                  color: CHART_COLORS.seriesPrimary,
                  points: historical.trainOccupancyPct.map((p) => ({ x: p.elapsedSimulationSeconds, y: p.value })),
                },
              ]}
              xFormat={formatElapsed}
              yFormat={(v) => `${Math.round(v)}%`}
            />
          </ChartCard>

          <ChartCard
            title="Delay over time"
            subtitle="Average and maximum seconds behind schedule across active trains, per bucket"
            kind="HISTORICAL"
            tableHeaders={["Time", "Avg delay", "Max delay"]}
            tableRows={historical.delay.map((p) => [formatElapsed(p.elapsedSimulationSeconds), formatSeconds(p.avgDelaySeconds), formatSeconds(p.maxDelaySeconds)])}
          >
            <LineChart
              series={[
                {
                  key: "avg",
                  label: "Avg delay",
                  color: CHART_COLORS.seriesPrimary,
                  points: historical.delay.map((p) => ({ x: p.elapsedSimulationSeconds, y: p.avgDelaySeconds })),
                },
                {
                  key: "max",
                  label: "Max delay",
                  color: CHART_COLORS.seriesSecondary,
                  points: historical.delay.map((p) => ({ x: p.elapsedSimulationSeconds, y: p.maxDelaySeconds })),
                },
              ]}
              xFormat={formatElapsed}
              yFormat={(v) => formatSeconds(v)}
            />
          </ChartCard>

          <ChartCard
            title="Trains operating over time"
            subtitle="Trains neither scheduled nor completed, averaged per bucket"
            kind="HISTORICAL"
            tableHeaders={["Time", "Trains operating"]}
            tableRows={historical.trainsOperating.map((p) => [formatElapsed(p.elapsedSimulationSeconds), formatCount(p.value)])}
          >
            <LineChart
              series={[
                {
                  key: "operating",
                  label: "Trains operating",
                  color: CHART_COLORS.seriesPrimary,
                  points: historical.trainsOperating.map((p) => ({ x: p.elapsedSimulationSeconds, y: p.value })),
                },
              ]}
              xFormat={formatElapsed}
              yFormat={(v) => formatCount(v)}
            />
          </ChartCard>

          <ChartCard
            title="Station congestion"
            subtitle="Passengers currently waiting, by station — colored by congestion band"
            kind="LIVE"
            tableHeaders={["Station", "Queue", "Congestion"]}
            tableRows={live.stations
              .slice()
              .sort((a, b) => b.currentQueue - a.currentQueue)
              .map((s) => [s.name, s.currentQueue, s.congestionLevel])}
          >
            <BarChart data={congestionBars} orientation="horizontal" valueFormat={(v) => formatCount(v)} />
          </ChartCard>

          <ChartCard
            title="Passenger waiting time"
            subtitle="How long currently-waiting passengers have been waiting for their first train"
            kind="LIVE"
            tableHeaders={["Band", "Passengers"]}
            tableRows={live.passengerWaitHistogram.map((b) => [b.label, b.passengerCount])}
          >
            <BarChart data={waitBars} orientation="vertical" valueFormat={(v) => formatCount(v)} />
          </ChartCard>
        </div>
      </section>

      {/* ---- Stations ---- */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Stations</h2>
          <KindBadge kind="SIMULATION_RESULT" />
          <span className="text-xs text-muted">since simulation start — not range-scoped</span>
        </div>
        <div className="scroll-thin overflow-x-auto rounded-lg border border-edge bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/3 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Station</th>
                <th className="px-3 py-2 font-medium">Throughput</th>
                <th className="px-3 py-2 font-medium">Avg queue</th>
                <th className="px-3 py-2 font-medium">Max queue</th>
                <th className="px-3 py-2 font-medium">Dwell time</th>
                <th className="px-3 py-2 font-medium">Congestion (now)</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {stationRows.map((s) => {
                const liveStation = liveStationById.get(s.stationId);
                return (
                  <tr key={s.stationId} className="border-t border-divider text-secondary">
                    <td className="px-3 py-1.5">{s.name}</td>
                    <td className="px-3 py-1.5">{formatCount(s.throughput)}</td>
                    <td className="px-3 py-1.5">{s.avgQueue.toFixed(1)}</td>
                    <td className="px-3 py-1.5">{s.maxQueue}</td>
                    <td className="px-3 py-1.5">{s.dwellTimeSeconds}s</td>
                    <td className="px-3 py-1.5">
                      {liveStation && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset"
                          style={congestionChipStyle(liveStation.congestionLevel)}
                        >
                          {CONGESTION_LABEL[liveStation.congestionLevel]}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
