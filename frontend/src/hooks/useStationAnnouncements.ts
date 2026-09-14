import { useCallback, useEffect, useRef, useState } from "react";
import type { StationLayout3D, TrainVisual3D } from "@/domain/station3d";
import type { AnnouncementEvent } from "@/domain/announcement";
import { deriveAnnouncements } from "@/lib/station3d/announcementService";

/**
 * Watches this station's `TrainVisual3D`s for real phase transitions and surfaces each newly-fired
 * `AnnouncementEvent` exactly once — `latest` changes identity only when a brand new event fires, so
 * a consumer's `useEffect` keyed on `latest?.id` (see `AudioManager`/caption wiring in
 * `StationScene`) reacts to it exactly once, never replays it on an unrelated re-render, and never
 * misses one bunched together with others in the same tick (all of a tick's events are queued via
 * `pending`, drained one at a time by the same consumer).
 */
export function useStationAnnouncements(
  station: StationLayout3D,
  trains: readonly TrainVisual3D[]
): { latest: AnnouncementEvent | null; queue: readonly AnnouncementEvent[]; consume: () => void } {
  const previousRef = useRef<Map<number, TrainVisual3D>>(new Map());
  const [queue, setQueue] = useState<readonly AnnouncementEvent[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    const events = deriveAnnouncements(previous, trains, station);

    const next = new Map<number, TrainVisual3D>();
    for (const t of trains) next.set(t.trainId, t);
    previousRef.current = next;

    if (events.length > 0) {
      setQueue((current) => [...current, ...events]);
    }
    // `station` only changes when the operator switches stations (a fresh mount for this hook's
    // owner in practice), so this effect really only needs to react to `trains` — but including it
    // keeps the dependency list honest about everything `deriveAnnouncements` reads.
  }, [trains, station]);

  const consume = useCallback(() => setQueue((current) => current.slice(1)), []);

  return { latest: queue[0] ?? null, queue, consume };
}
