"use client";

import { useEffect, useState } from "react";
import { mapPreferences, DEFAULT_MAP_PREFERENCES, type MapPreferences } from "@/lib/map/preferences";

/** React binding over the `mapPreferences` store — same shape as `useAudioSettings`. Starts from
 * the defaults so server and client agree on the first render, then picks up the persisted values
 * on subscribe. */
export function useMapPreferences(): readonly [MapPreferences, (patch: Partial<MapPreferences>) => void] {
  const [preferences, setPreferences] = useState<MapPreferences>(DEFAULT_MAP_PREFERENCES);

  useEffect(() => mapPreferences.subscribe(setPreferences), []);

  return [preferences, (patch) => mapPreferences.update(patch)] as const;
}
