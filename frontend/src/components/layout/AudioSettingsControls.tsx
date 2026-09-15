"use client";

import { LANGUAGE_MODE_PRESETS, type LanguageMode } from "@/domain/announcement";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ToggleRow } from "./ToggleRow";

function presetIdFor(mode: LanguageMode): string {
  return mode.join("-");
}

/**
 * Announcement and ambience controls.
 *
 * Shared between the navbar's settings menu and the 3D station overlay rather than duplicated:
 * both write through `useAudioSettings` to the same persisted `audioManager`, so changing the
 * language inside a station and changing it from the navbar are the same action.
 */
export function AudioSettingsControls() {
  const [settings, update] = useAudioSettings();

  return (
    <div className="space-y-1">
      <ToggleRow
        label="Mute all audio"
        checked={settings.muted}
        onChange={(muted) => update({ muted })}
      />
      <ToggleRow
        label="Announcements"
        checked={settings.announcementsEnabled}
        onChange={(announcementsEnabled) => update({ announcementsEnabled })}
        disabled={settings.muted}
      />
      <ToggleRow
        label="Ambient audio"
        checked={settings.ambienceEnabled}
        onChange={(ambienceEnabled) => update({ ambienceEnabled })}
        disabled={settings.muted}
      />

      <label className="flex items-center gap-3 px-1.5 py-1.5 text-xs text-secondary">
        <span className="w-16 shrink-0">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          disabled={settings.muted}
          onChange={(e) => update({ volume: Number(e.target.value) })}
          className="flex-1 accent-[var(--color-accent)] disabled:opacity-40"
          aria-label="Master volume"
        />
      </label>

      <Field label="Announcement language" className="px-1.5 pt-1.5">
        <Select
          value={presetIdFor(settings.languageMode)}
          onChange={(e) => {
            const preset = LANGUAGE_MODE_PRESETS.find((p) => p.id === e.target.value);
            if (preset) update({ languageMode: preset.languages });
          }}
        >
          {LANGUAGE_MODE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
