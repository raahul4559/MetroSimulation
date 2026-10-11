# 3D station audio assets

This tree is a drop-in slot for real sound files, checked at runtime by `AudioManager`
(`frontend/src/lib/audio/AudioManager.ts`). Nothing in this repo ships real recordings —
until a file is added, every sound is procedurally synthesized in the browser
(`frontend/src/lib/audio/synth.ts`) so the station is never silent.

Do **not** add real Namma Metro recordings here unless you have the rights to redistribute
them, and never label a synthesized file as an authentic recording.

## Expected paths

| Path | Used for |
| --- | --- |
| `doors/open.mp3` | Door-opening chime |
| `doors/close.mp3` | Door-closing chime |
| `trains/rumble.mp3` | Train approach/departure movement sound |
| `ambience/` | Reserved for a future station ambience loop (currently always synthesized) |
| `announcements/manifest.json` | Licensed real recordings of fixed announcement phrases — see below |

Adding a file at one of the `doors`/`trains` paths above is picked up automatically — no
code change needed, `AudioManager` fetches it once, caches the decoded buffer, and prefers
it over the synthesized fallback.

## Spoken announcements

Announcements are event-driven: `lib/station3d/announcementService.ts` detects them from the
canonical realtime frame (train phase edges, delays, injected disruptions, realtime alerts) —
nothing is announced from a timer. Each event is queued by priority
(`EMERGENCY > SAFETY > SERVICE_DISRUPTION > TRAIN_APPROACHING > TRAIN_ARRIVING > TRAIN_DEPARTING >
NEXT_STATION > GENERAL_INFORMATION`) and spoken through the best voice tier available for that
exact sentence:

1. **Recording** — a real clip listed in `announcements/manifest.json` (below).
2. **Synthetic voice** — a Google Cloud TTS clip, synthesized once, PA-processed and cached on the
   backend (`ANNOUNCEMENT_AUDIO_CACHE_DIR`), mirrored in the browser's Cache Storage. Warm it ahead
   of time with `npm run preload-audio`.
3. **Browser voice** — the browser's own speech engine, only if it has a voice for that language.
4. **Text only** — the caption stays on screen long enough to read.

The caption always says which tier played. Synthetic and browser voices are never presented as real
Namma Metro audio; per-clip TTS provenance is at `GET /api/announcements/audio/manifest`.

### Adding a real recording

`announcements/manifest.json` ships with no clips: no legally reusable Namma Metro/BMRCL recording
is known. Do not add a capture of the real PA unless you hold the rights. A clip is only used if its
entry passes `lib/audio/recordedClips.ts`'s validation; invalid entries are skipped with a console
warning:

```json
{
  "clips": [
    {
      "id": "en-stand-clear",
      "language": "en",
      "text": "Please stand clear of the doors.",
      "file": "/audio/announcements/en/stand-clear.ogg",
      "attribution": "Recorded by …",
      "license": "CC-BY-4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
      "sourceUrl": "https://…",
      "official": false
    }
  ]
}
```

- `license` must be one of `CC0-1.0`, `PDM-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0`,
  `CC-BY-SA-4.0`, or `OWN-RECORDING` (the project's own voice recording; `sourceUrl` optional).
- `text` must match the sentence the templates produce for that language exactly (case, spacing and
  final punctuation are ignored). Recordings only replace fixed phrases, never sentences with a
  station or destination name in them.
- `official: true` is only accepted with an `officialPermission` field naming BMRCL's grant. Without
  it, the clip is labelled "not official BMRCL audio".
