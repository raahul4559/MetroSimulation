# API reference

Three independent base URLs on the same backend — see `docs/architecture.md` for why they're split:

- `http://localhost:8080/api/v1` — the legacy tick-only clock (Postgres-backed, kept for reference).
  Override with `NEXT_PUBLIC_API_BASE_URL` on the frontend, `SERVER_PORT`/`CORS_ALLOWED_ORIGINS` on
  the backend.
- `http://localhost:8080/api/metro` — the network graph and routing (JSON-dataset-backed). Override
  with `NEXT_PUBLIC_METRO_API_BASE_URL`.
- `http://localhost:8080/api/simulation` — the discrete-time train simulation engine (Postgres
  schedules + config, `metro`'s graph for topology). Frontend env var `NEXT_PUBLIC_TRAIN_SIM_API_BASE_URL`;
  this is the engine the map's train layer and sidebar (Simulation controls, Line filter, Train
  list/details) are wired to.

## REST — simulation clock (`/api/v1`)

| Method | Path | Description |
|---|---|---|
| GET | `/network/lines` | All lines, each with its ordered station list. |
| GET | `/network/lines/{code}` | One line by code (e.g. `PURPLE`). 404 if unknown. |
| GET | `/network/stations` | All stations, unordered. |
| GET | `/network/stations/{code}` | One station by code (e.g. `MAJESTIC`). 404 if unknown. |
| GET | `/network/tracks` | All directional track segments. |
| GET | `/simulation` | Current simulation state. |
| POST | `/simulation/start` | Set status to `RUNNING`; the tick loop starts advancing. |
| POST | `/simulation/pause` | Set status to `PAUSED`; the clock freezes at the current tick. |
| POST | `/simulation/reset` | Reload the active `simulation_config` and reset the clock to tick 0. |
| GET | `/actuator/health` | Liveness + DB connectivity (`components.db.status`). |

## REST — network graph & routing (`/api/metro`)

| Method | Path | Description |
|---|---|---|
| GET | `/stations` | All stations in the graph. |
| GET | `/stations/{id}` | One station by numeric id. 404 if unknown. |
| GET | `/lines` | All lines, each with its ordered station list. |
| GET | `/lines/{id}` | One line by numeric id. 404 if unknown. |
| GET | `/network` | Everything in one payload: `stations`, `lines`, `tracks`, `interchanges`. |
| GET | `/route?from={id}&to={id}` | Shortest path by expected travel time (Dijkstra). 404 if either station is unknown or no path exists. |

Example — the network's frontend map is one call:

```bash
curl http://localhost:8080/api/metro/network
```

Example — the worked routing case from the spec (Whitefield → Majestic, ids from a fresh load of
the bundled dataset; confirm actual ids via `/api/metro/stations` since they come from the dataset,
not a guarantee):

```bash
curl "http://localhost:8080/api/metro/route?from=9&to=5"
# {"stations":[...Whitefield ... Baiyappanahalli ... Indiranagar ... MG Road ... Majestic...],
#  "totalDistanceMetres":24800,"totalTravelTimeSeconds":2627}
```

## REST — discrete-time train simulation (`/api/simulation`)

| Method | Path | Description |
|---|---|---|
| POST | `/start` | Set status to `RUNNING` (also resumes from `PAUSED`/`STOPPED`). |
| POST | `/pause` | Freeze the clock at the current tick; state is preserved for `/start` to resume. |
| POST | `/stop` | Halt the clock (distinct status from `PAUSED`, same effect on the tick loop); state preserved. |
| POST | `/reset` | Rebuild the initial state from Postgres (roster/config) + the metro graph (topology). Tick 0, all trains back at their route origins. |
| POST | `/speed?value={0.5\|1\|2\|5\|10\|50}` | Not in the original endpoint list, but necessary to reach the required speed multipliers from outside the process. 400 on any other value. |
| GET | `/state` | Full snapshot: clock, every train's position/status, and every block's signal. |
| GET | `/time` | Just the clock — status, current tick, simulation time, speed. |

Example — start, speed up, and watch a train actually move (not teleport) along a real track:

```bash
curl -X POST http://localhost:8080/api/simulation/start
curl -X POST "http://localhost:8080/api/simulation/speed?value=10"
curl http://localhost:8080/api/simulation/state
# trains[].progress moves continuously 0→1 across ticks; trains[].speedKmph is real per-train
# momentum — accelerates toward maxSpeedKmph, cruises, brakes to a stop at the platform — and
# trains[].status starts SCHEDULED until scheduledDepartureSeconds, generated from each line's
# LineSchedule (see docs/architecture.md).
```

### Error format

Every error is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `ProblemDetail`:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Station not found: NOPE",
  "instance": "/api/v1/network/stations/NOPE"
}
```

Not-found → 404, invalid simulation state transition → 409, bean-validation failure → 400,
anything unexpected → 500 with a `correlationId` property (also logged server-side, stack trace
never leaked to the client).

## WebSocket (STOMP over `/ws`)

One STOMP endpoint, three topics:

- `/topic/simulation` — the legacy tick clock. Broadcast on every tick and on every
  `start`/`pause`/`reset` at `/api/v1/simulation`:
  ```json
  { "status": "RUNNING", "currentTick": 42, "elapsedSimulationMs": 42000 }
  ```
- `/topic/train-simulation/state` — the discrete-time engine's full state, broadcast every tick
  (real-time train positions):
  ```json
  { "clock": { "status": "RUNNING", "currentTick": 12, "elapsedSimulationSeconds": 60, "speed": 5.0, ... },
    "trains": [ { "code": "P01", "status": "RUNNING", "progress": 0.34, "speedKmph": 34.0,
                  "scheduledDepartureSeconds": 0, "maxSpeedKmph": 80.0, "delaySeconds": 0, ... } ],
    "signals": [ { "id": "SIG-8", "trackId": 8, "protectedSectionId": 8, "blockState": "OCCUPIED",
                   "aspect": "RED", "controllingTrainId": 1000 } ] }
  ```
- `/topic/train-simulation/events` — only the discrete occurrences from a tick (empty ticks publish
  nothing here), one array per message:
  ```json
  [ { "tick": 22, "type": "DEPARTED", "trainCode": "Y01", "message": "Y01 departed toward Central Silk Board" } ]
  ```

The frontend's wrapper for the legacy topic is `frontend/src/lib/ws/simulation-socket.ts`; the
trainsim state topic has its own wrapper at `frontend/src/lib/ws/train-simulation-socket.ts`
(`useTrainSimulation`/`useTrainSimulationSocket` bridge it into React) — both auto-reconnect with a
3-second backoff. Nothing consumes `/topic/train-simulation/events` from the frontend yet (the map
only needs continuous state, not the discrete event log) — verified directly with a raw STOMP client
instead.
