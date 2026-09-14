# API reference

Two independent base URLs on the same backend — see `docs/architecture.md` for why they're split:

- `http://localhost:8080/api/v1` — the simulation clock (Postgres-backed). Override with
  `NEXT_PUBLIC_API_BASE_URL` on the frontend, `SERVER_PORT`/`CORS_ALLOWED_ORIGINS` on the backend.
- `http://localhost:8080/api/metro` — the network graph and routing (JSON-dataset-backed). Override
  with `NEXT_PUBLIC_METRO_API_BASE_URL`.

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

Connect a STOMP client to `ws://localhost:8080/ws` (native WebSocket, no SockJS) and subscribe to
`/topic/simulation`. A message is broadcast on every tick and on every `start`/`pause`/`reset`:

```json
{ "status": "RUNNING", "currentTick": 42, "elapsedSimulationMs": 42000 }
```

The frontend's wrapper is `frontend/src/lib/ws/simulation-socket.ts`; it auto-reconnects with a
3-second backoff.
