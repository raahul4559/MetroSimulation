import { useEffect, useState } from "react";
import type { AudioSettings } from "@/domain/announcement";
import { audioManager } from "@/lib/audio/AudioManager";

/** Thin React binding over the `audioManager` singleton — settings live in the manager (and
 * localStorage) so they survive a `StationScene` remount, this hook just re-renders when they
 * change. */
export function useAudioSettings(): readonly [AudioSettings, (patch: Partial<AudioSettings>) => void] {
  const [settings, setSettings] = useState<AudioSettings>(() => audioManager.getSettings());

  useEffect(() => audioManager.subscribe(setSettings), []);

  return [settings, (patch) => audioManager.updateSettings(patch)] as const;
}
