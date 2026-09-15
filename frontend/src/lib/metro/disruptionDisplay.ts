import type {
  AffectedResourceType,
  DisruptionSeverity,
  DisruptionStatus,
  DisruptionType,
} from "@/domain/trainsim";

import type { Tone } from "@/lib/ui/tone";

export const DISRUPTION_STATUS_LABEL: Record<DisruptionStatus, string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

export const DISRUPTION_STATUS_TONE: Record<DisruptionStatus, Tone> = {
  SCHEDULED: "neutral",
  ACTIVE: "danger",
  RESOLVED: "positive",
  CANCELLED: "neutral",
};

export const DISRUPTION_TYPE_LABEL: Record<DisruptionType, string> = {
  TRAIN_FAILURE: "Train failure",
  SIGNAL_FAILURE: "Signal failure",
  STATION_CONGESTION: "Station congestion",
  TRACK_BLOCKAGE: "Track blockage",
  EXTENDED_DWELL: "Extended dwell",
  CUSTOM_DELAY: "Manual delay",
};

export const DISRUPTION_SEVERITY_LABEL: Record<DisruptionSeverity, string> = {
  MINOR: "Minor",
  MODERATE: "Moderate",
  MAJOR: "Major",
  SEVERE: "Severe",
};

/** Severity reads as escalating attention, not as four arbitrary colours. */
export const DISRUPTION_SEVERITY_TONE: Record<DisruptionSeverity, Tone> = {
  MINOR: "neutral",
  MODERATE: "warning",
  MAJOR: "warning",
  SEVERE: "danger",
};

export const RESOURCE_TYPE_LABEL: Record<AffectedResourceType, string> = {
  TRAIN: "Train",
  TRACK: "Track",
  STATION: "Station",
};
