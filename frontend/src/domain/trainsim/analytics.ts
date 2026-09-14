/** Mirrors the backend's `AnalyticsResponse` (trainsim/api/rest/dto/analytics) field-for-field —
 * see that file for what each section means. `kind` on `live`/`simulationResult`/`historical` is
 * the literal string the dashboard uses to badge each section, straight off the data rather than
 * hardcoded per-component. */

export type AnalyticsRange = "CURRENT_HOUR" | "FULL" | "CUSTOM";

export interface AnalyticsMeta {
  range: AnalyticsRange;
  fromSimTime: string;
  toSimTime: string;
  fromElapsedSeconds: number;
  toElapsedSeconds: number;
  generatedAtSimTime: string;
  generatedAtTick: number;
}

export type CongestionLevel = "LOW" | "MEDIUM" | "HIGH";

export interface LiveStation {
  stationId: number;
  code: string;
  name: string;
  currentQueue: number;
  dwellTimeSeconds: number;
  congestionLevel: CongestionLevel;
}

export interface WaitTimeBucket {
  label: string;
  passengerCount: number;
}

export interface LiveMetrics {
  kind: "LIVE";
  network: {
    activeTrains: number;
    activeStations: number;
    networkUtilizationPct: number;
    activeDisruptions: number;
  };
  trains: {
    avgSpeedKmph: number;
    currentAvgDelaySeconds: number;
    currentMaxDelaySeconds: number;
    trainUtilizationPct: number;
  };
  currentAvgOccupancyPct: number;
  stations: LiveStation[];
  passengerWaitHistogram: WaitTimeBucket[];
}

export interface ResultStation {
  stationId: number;
  code: string;
  name: string;
  throughput: number;
  avgQueue: number;
  maxQueue: number;
  dwellTimeSeconds: number;
}

export interface SimulationResultMetrics {
  kind: "SIMULATION_RESULT";
  network: {
    avgNetworkUtilizationPct: number;
  };
  trains: {
    avgSpeedKmph: number;
    avgDelaySeconds: number;
    maxDelaySeconds: number;
    onTimePct: number;
    avgUtilizationPct: number;
  };
  passengers: {
    totalGenerated: number;
    totalCompleted: number;
    avgWaitingSeconds: number;
    avgJourneySeconds: number;
    avgOccupancyPct: number;
    unableToBoard: number;
  };
  stations: ResultStation[];
}

export interface SeriesPoint {
  elapsedSimulationSeconds: number;
  simTime: string;
  value: number;
}

export interface DelaySeriesPoint {
  elapsedSimulationSeconds: number;
  simTime: string;
  avgDelaySeconds: number;
  maxDelaySeconds: number;
}

export interface HistoricalSeries {
  kind: "HISTORICAL";
  bucketSeconds: number;
  passengerDemand: SeriesPoint[];
  trainOccupancyPct: SeriesPoint[];
  delay: DelaySeriesPoint[];
  trainsOperating: SeriesPoint[];
}

export interface AnalyticsResponse {
  meta: AnalyticsMeta;
  live: LiveMetrics;
  simulationResult: SimulationResultMetrics;
  historical: HistoricalSeries;
}
