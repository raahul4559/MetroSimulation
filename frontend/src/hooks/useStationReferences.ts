import { useEffect, useState } from "react";
import type { StationVisualReference } from "@/domain/stationVisualReference";

export type StationReferencesState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; data: StationVisualReference };

/**
 * Fetches `public/stations/<slug>/references.json` for the dev/admin reference panel — entirely
 * separate from `useStationAsset`, since this is documentation for a human comparing the
 * reconstruction to real sources, never an input to the render path itself. A missing or
 * malformed file resolves to `"unavailable"` rather than throwing, the same "absence degrades
 * gracefully" rule every other station-asset lookup in this codebase follows.
 */
export function useStationReferences(stationId: string): StationReferencesState {
  const [state, setState] = useState<StationReferencesState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    // Deferred to a microtask so this reset is async, not synchronous within the effect body
    // (avoids react-hooks/set-state-in-effect) — same pattern as `useStationAsset`.
    Promise.resolve().then(() => {
      if (!cancelled) setState({ status: "loading" });
    });

    fetch(`/stations/${stationId}/references.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("not found"))))
      .then((data: StationVisualReference) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [stationId]);

  return state;
}
