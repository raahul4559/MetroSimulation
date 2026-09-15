# Adding a Namma Metro station: reference → reconstruction pipeline

This is the repeatable process behind every station folder in `public/stations/<slug>/`. It
produces a station-specific procedural reconstruction grounded in real, publicly checkable
sources — never a photograph pasted into the 3D scene, and never a claim of exactness the sources
don't actually support.

## 0. Prerequisites

- The station already exists in the network dataset (`data/metro` / wherever `Station`/`Line`
  come from) with real `latitude`/`longitude` and its serving `lines`. This pipeline classifies
  and visually reconstructs a station; it does not invent one.
- A slug for its folder, e.g. `indiranagar` — `slugify(stationCode)` in
  `src/config/stations/stationConfigs.ts` derives this automatically from `stationCode`.

## 1. Collect public references (research, not scraping)

Search for the station by name + "Namma Metro" / "Bangalore Metro" and read (don't image-scrape):

- Wikipedia's station article, if one exists — usually the single richest source (infobox: build
  type, opening date, platform count, entrances, contractor).
- The line's Wikipedia article, for corridor/alignment context.
- Official BMRCL announcements or press coverage, when findable.
- Rider-information sites (nobroker.in, bengalurumetro.in, yometro.com, etc.) — useful for
  corroboration, but treat as secondary, not primary, evidence.
- News coverage for anything operationally notable (safety measures, crowding, recent works).

**Do not** bypass paywalls/logins, scrape image hosts, or download photographs. This pipeline
gathers *textual* architectural facts and cites the pages they came from — it does not build an
image archive. If a fact isn't stated by a source you can point to, it doesn't go in
`references.json` as fact; it either goes unstated or is explicitly marked as estimation in
`referenceNotes`.

## 2. Write `references.json`

Create `public/stations/<slug>/references.json` matching `StationVisualReference`
(`src/domain/stationVisualReference.ts`):

- `references.*` categories hold links to pages that *discuss* that aspect — not verified photos
  of it. Leave a category empty (`[]`) rather than guessing a URL for it.
- `sources[]` records full attribution per source: `url`, `title`, `publisher`, `retrievedOn`
  (today's date), `usageNote` (what you actually used it for, and its licence/reuse status —
  Wikipedia text is CC BY-SA 4.0; note that explicitly).
- `referenceNotes[]` is the honesty layer: one bullet for what's *actually supported* by the
  sources, one for what's *not* supported (and is therefore estimation), and one for any known
  renderer limitation (see step 4).
- `referenceConfidence`: `"high"` only when multiple sources corroborate both structural facts
  *and* some visual/material detail; `"medium"` when structural facts are solid but visual detail
  is thin; `"low"` for a station with no dedicated research pass yet.

## 3. Update `stationConfigs.ts`

Add or correct a curated entry in `src/config/stations/stationConfigs.ts`:

- `buildType` / `isInterchange` from the sources — if you're correcting a wrong prior entry (this
  happened for MG Road, previously mis-classified as `UNDERGROUND`), say so in `notes`.
- An `architecture: ArchitecturalProfile` (`src/domain/stationConfig.ts`) for whatever real facts
  justify station-specific geometry: `entranceCount`, `depthMeters` (underground), `hasMezzanine`
  (documented multi-level interchange), `landmark` (a real, named nearby feature), `accentColorHex`.
  Leave a field unset rather than filling it with an invented value — the renderer's defaults are
  intentionally generic, not wrong.
- `notes` should read like the `references.json` you just wrote, in one paragraph, and say "See
  references.json for sources" so the two files never drift silently apart.

## 4. Extend geometry only where the facts justify it

The shared procedural renderer (`components/station3d/environments/*`) already varies by
`buildType`; `ArchitecturalProfile` layers in station-specific detail on top (entrance canopies,
underground depth/mezzanine, a context landmark, an accent tint) — see
`ElevatedEnvironment.tsx`/`UndergroundEnvironment.tsx` for the current fields it reads.

If a new station needs a genuinely new kind of distinguishing detail no existing field covers,
add the field to `ArchitecturalProfile` and thread it through the same way — small, additive,
optional, defaulting to "generic shell" when absent. Do **not** special-case a station by name
inside a component; every station-specific difference must come from data (`architecture`),
never a hardcoded branch on `stationCode`.

If the real station's architecture needs something the shared layout engine fundamentally can't
represent (e.g. a genuinely stacked second platform level, not just a structural suggestion),
don't fake it — disclose the limitation in `referenceNotes` instead, the way Majestic's and
RV Road's entries do.

## 5. (Optional, later) Drop in a real mesh

Nothing above requires a `.glb`. If a real `model.glb` + `environment.glb` (+ `textures/`) later
become available for a station (licensed appropriately — see `references.json`'s `usageNote`s for
what's actually reusable), drop them into that station's folder. `useStationAsset` re-checks these
paths on every visit and promotes the station to `HIGH` fidelity automatically — no code changes.

## 6. Validate

Open `/stations` (the Station Assets dashboard) and confirm:

- The station's `buildType`/`isInterchange` match what you curated.
- No new `MISSING_COORDINATES` / `INTERCHANGE_FLAG_MISMATCH` / `INCOMPLETE_ASSET_SET` issues.
- The **References** column shows the confidence level you set.

Open the station itself in the 3D view and confirm the new `architecture` details actually render
(entrance canopies, landmark, mezzanine/upper-deck suggestion, accent tint) and toggle the 📎
references panel to confirm the citations show up correctly.
