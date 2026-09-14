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
| `announcements/` | Reserved for pre-recorded announcement clips — currently always synthesized speech via the browser's Speech Synthesis API, see below |

Adding a file at one of the `doors`/`trains` paths above is picked up automatically — no
code change needed, `AudioManager` fetches it once, caches the decoded buffer, and prefers
it over the synthesized fallback.

## Spoken announcements

Spoken PA announcements are a separate pipeline from the rest of this tree — they don't read
from `announcements/` today. `frontend/src/lib/audio/VoiceProvider.ts` speaks text through the
browser's own Speech Synthesis API, picking one Indian-accented voice per language (English,
Hindi, Kannada — see `LanguageCode`) and reusing it consistently rather than re-picking at
random. `frontend/src/lib/announcements/AnnouncementService.ts` is what builds that text, from
natural per-language templates (`lib/announcements/templates/`) and real network data — never a
literal runtime translation of English. To swap in a hosted/licensed TTS engine later, implement
the `VoiceProvider` interface and swap the module's export; nothing else in the announcement
pipeline needs to change.
