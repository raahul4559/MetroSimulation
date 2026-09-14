export type DisruptionType =
  | "TRAIN_FAILURE"
  | "SIGNAL_FAILURE"
  | "STATION_CONGESTION"
  | "TRACK_BLOCKAGE"
  | "EXTENDED_DWELL"
  | "CUSTOM_DELAY";

export type AffectedResourceType = "TRAIN" | "TRACK" | "STATION";

export type DisruptionSeverity = "MINOR" | "MODERATE" | "MAJOR" | "SEVERE";

export type DisruptionStatus = "SCHEDULED" | "ACTIVE" | "RESOLVED" | "CANCELLED";

/** Mirrors the backend's `DisruptionResponse`. */
export interface Disruption {
  readonly id: number;
  readonly type: DisruptionType;
  readonly resourceType: AffectedResourceType;
  readonly resourceId: number;
  readonly startSeconds: number;
  readonly durationSeconds: number;
  readonly endSeconds: number;
  readonly magnitudeSeconds: number;
  readonly severity: DisruptionSeverity;
  readonly description: string;
  readonly status: DisruptionStatus;
}

/** Body for `POST /api/simulation/disruptions` — mirrors `CreateDisruptionRequest`. For
 * TRACK_BLOCKAGE/SIGNAL_FAILURE supply fromStationId/toStationId; otherwise supply resourceId. */
export interface CreateDisruptionRequest {
  readonly type: DisruptionType;
  readonly resourceId?: number;
  readonly fromStationId?: number;
  readonly toStationId?: number;
  readonly durationSeconds: number;
  readonly severity: DisruptionSeverity;
  readonly magnitudeSeconds?: number;
  readonly description?: string;
}

/** Mirrors the backend's `DisruptionAnalyticsResponse` — `GET /api/simulation/analytics/delays`. */
export interface DisruptionAnalytics {
  readonly totalDelaySeconds: number;
  readonly averageDelaySeconds: number;
  readonly maxDelaySeconds: number;
  readonly affectedTrainsCount: number;
  readonly affectedPassengers: number;
}

/** The resource kind every {@link DisruptionType} targets — fixed, mirrors `Disruption.resourceTypeFor`. */
export function resourceTypeFor(type: DisruptionType): AffectedResourceType {
  switch (type) {
    case "TRAIN_FAILURE":
    case "EXTENDED_DWELL":
    case "CUSTOM_DELAY":
      return "TRAIN";
    case "TRACK_BLOCKAGE":
    case "SIGNAL_FAILURE":
      return "TRACK";
    case "STATION_CONGESTION":
      return "STATION";
  }
}
