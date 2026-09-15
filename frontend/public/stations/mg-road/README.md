# MG Road — 3D asset folder

Representative station for: **ELEVATED** (single line, side platforms).

Corrected from an earlier `UNDERGROUND` classification: the real Purple Line station on MG Road is
elevated, opened in 2011. A separate underground Pink Line platform pair is under construction
beneath it (targeted ~Dec 2026 per public sources) but doesn't exist yet, so it isn't modelled here
— see `references.json` and revisit once it opens.

No `model.glb` / `environment.glb` yet — renders via the viaduct-shell procedural renderer
(`components/station3d/environments/ElevatedEnvironment.tsx`) parameterized from
`stationConfigs.ts`'s `architecture` profile (entrance count, Cubbon Park landmark). Drop
`model.glb` + `environment.glb` (+ `textures/`) here to upgrade to HIGH fidelity — no code changes
required.

See `references.json` for the public sources this station's classification and architecture
profile are based on, and their confidence level.
