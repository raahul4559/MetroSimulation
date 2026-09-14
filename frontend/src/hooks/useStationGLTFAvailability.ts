import { useEffect, useState } from "react";

/**
 * Checks whether a real, station-specific 3D asset exists at
 * `/models/stations/<code>/station.glb` (served from `frontend/public`) — the "Support
 * station-specific assets" half of the spec. Returns the path once confirmed, or `null` to fall
 * back to the procedural station (the only outcome today, since no assets ship in this repo yet —
 * this is the extension point for whenever one does).
 *
 * <p>A `HEAD` request, not `useGLTF` itself, so a missing asset never throws inside a Suspense
 * boundary or spams a 404 through the GLTF loader — the caller decides what to render only after
 * knowing the asset is really there.
 */
export function useStationGLTFAvailability(stationCode: string): string | null {
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const candidate = `/models/stations/${stationCode.toLowerCase()}/station.glb`;
    // Deferred a microtask so the reset-to-null is async, not synchronous within the effect body
    // (avoids react-hooks/set-state-in-effect).
    Promise.resolve().then(() => {
      if (!cancelled) setPath(null);
    });

    fetch(candidate, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && res.ok) setPath(candidate);
      })
      .catch(() => {
        // No asset (or offline) — procedural fallback, not an error.
      });

    return () => {
      cancelled = true;
    };
  }, [stationCode]);

  return path;
}
