import type { DisruptionStatus, DisruptionType } from "@/domain/trainsim";

type Tone = "neutral" | "positive" | "warning" | "danger";

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
