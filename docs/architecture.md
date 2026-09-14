# Architecture

## Layout

```
MetroSimulation/
├── database/    Flyway migrations (schema + seed) — Postgres, backs the simulation clock/trains
├── data/        JSON metro network dataset — backs the in-memory routing graph (see below)
├── backend/     Spring Boot — network graph + routing, simulation clock, REST + WebSocket
├── frontend/    Next.js — visualization and controls, zero simulation/routing logic
└── docs/        this directory
```

## Two backend bounded contexts, on purpose

The backend has two independent verticals under `com.nammametro.simulation`, deliberately kept
separate rather than forced into one model:

| | `simulation` (original) | `metro` (network graph) |
|---|---|---|
| Concern | Mutable runtime state: trains, simulation clock, tick loop | Static topology: stations, lines, tracks, routing |
| Data source | PostgreSQL via JPA/Flyway | JSON files in `data/metro/`, loaded once at startup |
| Query pattern | Repository queries the DB per request | In-memory graph, built once, queried directly |
| REST prefix | `/api/v1/*` | `/api/metro/*` |

They share only the framework-free `Coordinates` record and the `ResourceNotFoundException` /
`GlobalExceptionHandler` plumbing. A station's identity, coordinates, and line membership are
answered by `metro`; whether a train is currently dwelling there is a `simulation` concern for a
future chunk. Forcing these into one model now would mean either querying Postgres per route-finding
call (the thing explicitly being avoided) or persisting mutable simulation state into a graph meant
to be rebuilt wholesale from a JSON file on every restart.

## `simulation`: hexagonal layering

```
com.nammametro.simulation
├── domain/          pure Java — records + enums + exceptions, zero Spring/JPA imports
├── application/
│   ├── port/in/     use-case interfaces (what the API layer calls)
│   ├── port/out/    repository/publisher interfaces (what the domain needs from outside)
│   └── service/     use-case implementations — NetworkQueryService, SimulationEngine
├── infrastructure/
│   └── persistence/ JPA entities, Spring Data repos, adapters, mappers — implements port/out
└── api/
    ├── rest/        controllers + DTOs (never expose JPA entities or domain records directly)
    └── websocket/   STOMP config + event publisher — implements port/out
```

Dependencies point inward: `api` and `infrastructure` depend on `application`, which depends on
`domain`. `application/service` classes do use `@Service`/`@Scheduled` for Spring wiring — that's DI
plumbing, not business logic. The one rule held firmly is `domain/`: it never imports Spring, JPA, or
Jackson.

`SimulationEngine` holds an `AtomicReference<Simulation>` and a `@Scheduled` tick loop. On each tick
it calls `Simulation.withNextTick()` (pure, on the immutable domain record) and then runs every
registered `TickHandler` — currently none. That list is the seam future chunks (train movement, dwell
timing, passenger spawning, signalling) plug into, without touching the clock, REST, or WebSocket.

## `metro`: graph + routing

```
com.nammametro.simulation.metro
├── domain/model/        Station, Line, Track, Interchange, StationType — pure Java records
├── network/             MetroNetwork (the in-memory graph) + validation types — pure Java
├── routing/             DijkstraRouteFinder + Route — pure Java, no Spring
├── infrastructure/
│   ├── loader/          MetroDataLoader (reads classpath JSON) + MetroNetworkAssembler
│   └── config/          MetroNetworkConfig — builds the MetroNetwork bean once at startup
└── api/rest/            MetroController + DTOs
```

`MetroNetwork` and `DijkstraRouteFinder` import nothing from Spring — both are exercised directly in
`backend/src/test/java/.../metro/{network,routing}` without a Spring context. `MetroNetworkConfig`
builds the graph once at application startup and calls `MetroNetwork.validate()`; if it finds any
`ERROR`-severity issue the application **refuses to start**, with the specific issue in the log — a
bad dataset fails loudly at boot, not silently at query time. See `data/README.md` for the dataset
format and the exact checks performed.

Station type (`REGULAR` / `INTERCHANGE` / `TERMINAL`) and a station's line memberships are *derived*
from `lines.json` at load time, not authored redundantly per station — a station can't claim to be an
interchange in one place and not appear on two lines in another.

## Frontend: no simulation or routing logic in components

```
frontend/src/
├── domain/
│   ├── metro/     TypeScript interfaces mirroring the metro API — the map's data contract
│   ├── simulation.ts, train.ts   mirroring the simulation-clock API
├── lib/
│   ├── api/       client.ts (two base URLs: /api/v1 and /api/metro), network/simulation/metro clients
│   ├── ws/        STOMP WebSocket client, independent of React
│   └── geometry/  pure lat/lng → SVG (x, y) projection and path-building functions
├── hooks/         bridges lib/* into React state (useNetwork, useSimulationState, useSimulationSocket)
└── components/    presentational — map, controls, network, ui
```

`useNetwork` now calls `/api/metro/network` (one call, the full graph) instead of the old two-call
`/api/v1/network/lines` + `/stations`. `components/map/MetroMap.tsx` never computes a coordinate
itself; it calls `buildProjector()` from `lib/geometry` and renders whatever it returns — the map
component doesn't know or care whether a station is real-world-projected or manually laid out.

## Why a schematic (not geographic) map

The map is a projected SVG diagram, not a tile-based map — no map provider, no API key, and the
projection math is trivial to reason about and test. Stations still store real `latitude`/`longitude`;
`lib/geometry/projection.ts` is the one place that turns them into pixels, so a geographic (tile-based)
renderer is an additive change later, not a data model change.

## Explicitly deferred

Train movement, dwell timing, headway/signalling logic, passenger generation and persistence,
capacity handling, delays/disruptions, analytics, auth, and CI are out of scope. Passenger routing
UI (a "plan a trip" screen using `/api/metro/route`) is built and verified on the backend but not yet
wired into the frontend — the spec for this chunk scoped the frontend to the network visualization
only. See `docs/domain-model.md` for which domain records exist but have no behaviour yet.
