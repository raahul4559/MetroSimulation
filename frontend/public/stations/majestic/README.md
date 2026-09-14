# Majestic (Nadaprabhu Kempegowda Station) — 3D asset folder

Representative station for: **UNDERGROUND**, **INTERCHANGE**, and "complex station" (two lines,
multiple platforms, transfer walkway).

This folder currently has no `model.glb` / `environment.glb` — the app renders this station via
the **PROCEDURAL/RECONSTRUCTED** tier, parameterized entirely from `metadata.json` and the matching
entry in `frontend/src/config/stations/stationConfigs.ts` (underground tunnel shell, two platform
modules — one per line — the interchange transfer walkway, and the multi-line concourse sign).

To upgrade this station to **HIGH fidelity**, drop in:

```text
model.glb          # station architecture: concourse, both platforms, pillars, stairs/escalators, signage
environment.glb    # immediate surrounding context (street entrances, KSR bus stand massing, etc.)
textures/          # any textures the above reference
```

No code changes are needed — `useStationAsset` re-checks these paths on every visit and switches
to the `HIGH` tier automatically once both files exist and load successfully.
