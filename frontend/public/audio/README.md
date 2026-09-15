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
| `announcements/` | Unused by design — see below |

Adding a file at one of the `doors`/`trains` paths above is picked up automatically — no
code change needed, `AudioManager` fetches it once, caches the decoded buffer, and prefers
it over the synthesized fallback.

## Spoken announcements

`announcements/` stays empty on purpose — spoken PA clips are **not** static files shipped in
this repo. They're synthesized once (Google Cloud TTS), processed to sound like they're coming
through a station PA system, and cached — but the cache lives on the **backend**
(`backend/.../announcement/`, disk cache under `ANNOUNCEMENT_AUDIO_CACHE_DIR`), served over HTTP
at `POST /api/announcements/audio`, and mirrored client-side in the browser's own `Cache Storage`
(see `frontend/src/lib/audio/VoiceProvider.ts`'s `CachedAudioVoiceProvider`). Keeping one cache
(backend disk + manifest) instead of also duplicating clips into this static folder avoids two
copies of the same audio silently drifting out of sync with each other.

`frontend/src/lib/announcements/AnnouncementService.ts` builds the text to speak from natural
per-language templates (`lib/announcements/templates/`) and real network data — never a literal
runtime translation of English. `VoiceProvider.ts`'s `CachedAudioVoiceProvider` is what turns that
text into the cached, processed clip; it falls back to the browser's own Speech Synthesis API
(the previous, more robotic-sounding default) whenever the backend has no credentials configured,
is unreachable, or synthesis otherwise fails — never breaking the announcement, only its voice
quality. See `docs/architecture.md` for the full pipeline and `npm run preload-audio` to warm the
backend's cache ahead of time for the common phrases.

Every synthesized clip's provenance (source, voice, license note, generation timestamp) is
queryable at `GET /api/announcements/audio/manifest` — there is no legally reusable real Namma
Metro/BMRCL recording behind any of this, and that stays visible rather than only true in code.
