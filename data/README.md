# Metro network dataset

`metro/stations.json`, `metro/lines.json`, `metro/tracks.json` are the **single canonical source**
for the metro network graph used by the backend's `MetroNetwork` service and `/api/metro/*`
endpoints. They are loaded once at startup (see `backend/.../metro/infrastructure/loader/`) into an
in-memory graph — nothing in that code path queries a database.

This is a deliberately-simplified real subset of Namma Metro (21 stations across the Purple, Green,
and Yellow lines, same station names/topology as `database/README.md`'s Postgres seed, extended one
stop further east to Whitefield so a cross-line route like Whitefield → Majestic is directly
demonstrable). Coordinates are approximate — plausible, not survey-grade — same caveat as the
database seed.

## Schema

**stations.json** — array of `{ id, code, name, latitude, longitude }`. `code` is the stable
cross-reference key used by `lines.json` and `tracks.json`; `id` is a numeric identifier for the API.
Station type (`REGULAR` / `INTERCHANGE` / `TERMINAL`) and line membership are **not** stored here —
they're derived at load time from `lines.json`, so the dataset can't self-contradict.

**lines.json** — array of `{ id, code, name, color, stationCodes: [...] }`. `stationCodes` is the
line's stations in travel order. A station code appearing in more than one line's list is an
interchange by construction.

**tracks.json** — array of `{ id, lineCode, fromStationCode, toStationCode, distanceMetres,
expectedTravelTimeSeconds }`. Each entry is one undirected edge between adjacent stations; the graph
adds it in both directions. `geometry` (an optional array of `{latitude, longitude}` waypoints) is
supported by the loader but not populated in this dataset.

## Replacing the dataset

Swap these three files for updated data and restart the backend. `MetroNetwork.validate()` runs at
startup and fails loudly (with specific error messages) on: duplicate station IDs, track references
to unknown stations, zero/negative-length tracks, duplicate tracks between the same pair, and lines
with fewer than two stations. Missing/out-of-bounds coordinates are logged as warnings, not fatal.
