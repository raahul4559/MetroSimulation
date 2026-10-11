# Realtime data foundation

The app renders one **canonical metro state**, whichever source the trains came from:

```
External data ─► MetroRealtimeProvider ─► FeedNormalizer ─► MetroStateManager ─► /topic/realtime/state ─► SimulationProvider (frontend store)
 (feed/timetable/   (one per source)       (validate, map,    (pick source, stale    + GET /api/realtime/state     ─► 2D map, 3D station, boards,
  simulation)                               reject w/ reason)  detection, ids, IST)                                    announcements, operations
```

Code: `backend/.../realtime/` (backend), `frontend/src/hooks/useMetroRealtime.ts`, `frontend/src/lib/realtime/` (frontend).

## Sources and honesty rules

| `DataSource`    | Provider                   | Meaning                                         | Can be "Live"? |
|-----------------|----------------------------|-------------------------------------------------|----------------|
| `LIVE`          | `OfficialRealtimeProvider` | An authorized operator feed (JSON contract below) | Yes, when fresh |
| `GTFS_REALTIME` | `GtfsRealtimeProvider`     | Any GTFS-Realtime protobuf feed, configured by URL | Shown as "Realtime (GTFS-RT)" when fresh |
| `SCHEDULE`      | `ScheduleProvider`         | Where the configured timetable says trains should be | **Never** |
| `SIMULATION`    | `SimulationProvider`       | The discrete-time simulation engine             | **Never** |

* Every train carries `source`, `observedAt`, `stale` and `positionEstimated`.
* The server computes `isLive` (observed source **and** fresh). The frontend only says "Live" when
  `isLive` is true **and** frames are still arriving (`lib/realtime/provenance.ts`). Socket
  connectivity alone never produces a "Live" label.
* Fields a source doesn't know are `null` (passenger counts from a feed, delays from a timetable),
  and the UI shows them as unknown — never as `0` or "On time".
* No external API is compiled in. No public BMRCL realtime API is assumed to exist; every endpoint
  is configuration and empty by default (`UNCONFIGURED`, never polled).
* No timetable hours are assumed either: `realtime.timetable` is empty until filled from a cited
  BMRCL notice. Without it, line status is `UNKNOWN` and `SCHEDULE` is unavailable.

## Source selection (`realtime.mode`, `POST /api/realtime/mode?value=`)

* `AUTO` (default): first healthy of `LIVE → GTFS_REALTIME → SCHEDULE → SIMULATION`.
  With nothing configured this is the simulation, labelled as such — the existing behaviour.
* A pinned mode (`LIVE`, `GTFS_REALTIME`, `SCHEDULE`, `SIMULATION`) never silently falls back.
  If a pinned feed fails, the state says so (stale trains, or none, plus `sourceReason`).
* The mode set over the API is not persisted; a restart returns to `realtime.mode`.

## Time

* Canonical timezone **Asia/Kolkata**. Service days roll over at
  `realtime.timetable.service-day-rollover` (default 03:00 IST); timetable times may exceed 24:00.
* The server clock is authoritative. Every frame carries `serverTime`, `serverTimeIst` and
  `serverEpochMillis`; the browser derives its offset from them (`lib/realtime/serverClock.ts`) and
  shows server time in IST. `GET /api/realtime/time` returns just the clock.

## Freshness, errors, reconnects

* `realtime.stale-after` (90s): an observation older than this is `stale` — still shown (faded,
  dashed outline on the map), never extrapolated. A feed whose own header timestamp stops
  advancing goes `STALE` even if HTTP requests keep succeeding.
* `realtime.expire-after` (5m): older observations are dropped rather than left frozen on the map.
* Timestamps more than `max-clock-skew` in the future are clamped to server time and warned.
* Polling runs on its own threads (never the simulation tick thread), with per-request timeouts,
  a 20 MB response cap, exponential backoff with jitter up to `max-backoff`, and logs on the first
  failure, every 10th, and on recovery. Error messages never include query strings or headers.
* Vehicles that can't be placed are rejected with a reason (`UNKNOWN_ROUTE`, `AMBIGUOUS_DIRECTION`,
  `OFF_NETWORK`, `EXPIRED`, `MISSING_ID`, `NO_POSITION`), counted per provider in `providers[]`.
* Frames are ordered by `(instanceId, version)`; the client drops out-of-order frames and accepts
  a new `instanceId` (backend restart). The socket reconnects with exponential backoff (1s → 30s)
  and re-seeds over REST on every reconnect. No frame for 5s marks the view "No updates · last known".

## Endpoints

| Method | Path | |
|---|---|---|
| GET  | `/api/realtime/state` | Current canonical state (same shape as each WebSocket frame) |
| GET  | `/api/realtime/time`  | Authoritative server time |
| POST | `/api/realtime/mode?value=AUTO\|LIVE\|GTFS_REALTIME\|SCHEDULE\|SIMULATION` | Change source selection |
| GET  | `/api/realtime/providers/{source}/feed` | A provider's raw, un-normalized snapshot (diagnostics) |
| WS   | `/topic/realtime/state` | One frame per simulation tick while the simulation is the source; otherwise every `publish-interval-ms` |

The simulation's own `/api/simulation/*` and `/topic/train-simulation/*` are unchanged.

## Configuration

See `realtime:` in `backend/src/main/resources/application.yml` and `backend/.env.example`.
Feed identifiers are mapped onto this network with `mapping.stop-ids`, `mapping.route-ids` and
`mapping.direction-ids` per provider; unmapped ids fall back to matching station/line codes.

## Official feed JSON contract (`REALTIME_OFFICIAL_URL`)

An authorized integration serves this shape directly, or a small adapter translates its own format
into it. One GET returns everything. Timestamps are ISO-8601 strings or epoch seconds. Everything
except `vehicleId` (or `tripId`) is optional; malformed entries are skipped and counted.

```json
{
  "generatedAt": "2026-10-12T04:00:00Z",
  "vehicles": [
    { "vehicleId": "T17", "label": "17", "tripId": "…", "routeId": "PURPLE", "directionId": 0,
      "stopId": "MAJESTIC", "status": "STOPPED_AT | INCOMING_AT | IN_TRANSIT_TO",
      "latitude": 12.97, "longitude": 77.57, "bearing": 90, "speedMps": 12.5,
      "timestamp": "2026-10-12T03:59:55Z" }
  ],
  "tripUpdates": [
    { "tripId": "…", "routeId": "PURPLE", "directionId": 0, "vehicleId": "T17", "timestamp": "…",
      "stops": [ { "stopId": "…", "sequence": 3, "arrival": "…", "departure": "…",
                   "delaySeconds": 45, "skipped": false } ] }
  ],
  "alerts": [
    { "id": "…", "cause": "…", "effect": "NO_SERVICE", "severity": "INFO | WARNING | SEVERE",
      "header": "…", "description": "…", "activeFrom": "…", "activeUntil": "…",
      "routeIds": ["PURPLE"], "stopIds": [] }
  ]
}
```

An alert with effect `NO_SERVICE` on a whole line marks that line `SUSPENDED`.
