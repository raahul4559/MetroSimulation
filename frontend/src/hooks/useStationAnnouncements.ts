import { useCallback, useEffect, useRef, useState } from "react";
import type { StationLayout3D, TrainVisual3D } from "@/domain/station3d";
import type { AnnouncementEvent } from "@/domain/announcement";
import type { Disruption } from "@/domain/trainsim";
import type { RealtimeAlert } from "@/domain/realtime";
import {
  deriveAlertAnnouncements,
  deriveAnnouncements,
  deriveDisruptionAnnouncements,
} from "@/lib/station3d/announcementService";

const NO_DISRUPTIONS: readonly Disruption[] = [];
const NO_ALERTS: readonly RealtimeAlert[] = [];

/**
 * Watches this station's `TrainVisual3D`s (and, if supplied, the canonical frame's `Disruption`s
 * and realtime alerts) for real
 * transitions and surfaces each newly-fired `AnnouncementEvent` exactly once — `latest` changes
 * identity only when a brand new event fires, so a consumer's `useEffect` keyed on `latest?.id` (see
 * `StationScene`, which hands each one to `AnnouncementService`) reacts to it exactly once, never
 * replays it on an unrelated re-render, and never misses one bunched together with others in the
 * same tick (all of a tick's events are queued via `pending`, drained one at a time by the same
 * consumer).
 */
export function useStationAnnouncements(
  station: StationLayout3D,
  trains: readonly TrainVisual3D[],
  disruptions: readonly Disruption[] = NO_DISRUPTIONS,
  alerts: readonly RealtimeAlert[] = NO_ALERTS
): { latest: AnnouncementEvent | null; queue: readonly AnnouncementEvent[]; consume: () => void } {
  const previousTrainsRef = useRef<Map<number, TrainVisual3D>>(new Map());
  const previousDisruptionIdsRef = useRef<ReadonlySet<number>>(new Set());
  // `null` until the first pass: alerts already active when the station opens are context, not news.
  const previousAlertIdsRef = useRef<ReadonlySet<string> | null>(null);
  const [queue, setQueue] = useState<readonly AnnouncementEvent[]>([]);

  useEffect(() => {
    const previousTrains = previousTrainsRef.current;
    const trainEvents = deriveAnnouncements(previousTrains, trains, station);

    const nextTrains = new Map<number, TrainVisual3D>();
    for (const t of trains) nextTrains.set(t.trainId, t);
    previousTrainsRef.current = nextTrains;

    const { events: disruptionEvents, activeIds } = deriveDisruptionAnnouncements(
      station,
      disruptions,
      previousDisruptionIdsRef.current
    );
    previousDisruptionIdsRef.current = activeIds;

    const alertResult = deriveAlertAnnouncements(station, alerts, previousAlertIdsRef.current ?? new Set());
    const alertEvents = previousAlertIdsRef.current ? alertResult.events : [];
    previousAlertIdsRef.current = alertResult.activeIds;

    const events = [...trainEvents, ...disruptionEvents, ...alertEvents];
    if (events.length > 0) {
      setQueue((current) => [...current, ...events]);
    }
    // `station` only changes when the operator switches stations (a fresh mount for this hook's
    // owner in practice), so this effect really only needs to react to the frame's data — but
    // including it keeps the dependency list honest about everything the derivations read.
  }, [trains, disruptions, alerts, station]);

  const consume = useCallback(() => setQueue((current) => current.slice(1)), []);

  return { latest: queue[0] ?? null, queue, consume };
}
