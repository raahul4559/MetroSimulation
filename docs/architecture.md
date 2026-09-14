# Architecture

## Layout

```
MetroSimulation/
├── database/    Flyway migrations (schema + seed) — Postgres, backs the train roster/sim config
├── data/        JSON metro network dataset — backs the in-memory routing graph (see below)
├── backend/     Spring Boot — network graph + routing, discrete-time train sim, REST + WebSocket
├── frontend/    Next.js — visualization and controls, zero simulation/routing logic
└── docs/        this directory
```

## Three backend verticals, on purpose

The backend has three independent verticals under `com.nammametro.simulation`, deliberately kept
separate rather than forced into one model:

| | `simulation` (original) | `metro` (network graph) | `trainsim` (discrete-time engine) |
|---|---|---|---|
| Concern | Legacy tick-only clock (kept for reference, independent) | Static topology: stations, lines, tracks, routing | Runtime train movement, dwell, headway, events |
| Data source | PostgreSQL via JPA/Flyway | JSON files in `data/metro/`, loaded once at startup | Postgres (roster + config) + `metro`'s graph (topology) |
| Query pattern | Repository queries the DB per request | In-memory graph, built once, queried directly | In-memory `SimulationState`, rebuilt from Postgres+graph at startup/reset |
| REST prefix | `/api/v1/*` | `/api/metro/*` | `/api/simulation/*` |
| WebSocket topic | `/topic/simulation` | — | `/topic/train-simulation/{state,events}` |

They share the framework-free `Coordinates` record, `TrainDirection` enum, `ResourceNotFoundException`
/ `GlobalExceptionHandler` plumbing, and (crucially) `trainsim` depends on both `simulation` (for the
persisted `Train`/`SimulationConfig` roster, via the existing `TrainRepository` /
`SimulationConfigRepository` out-ports) and `metro` (for real station/track topology via
`MetroNetwork`). Nothing in `trainsim` queries Postgres or the graph *during* a tick — both are read
once, at startup or `reset()`, into an immutable `SimulationState`; the tick loop itself only ever
transforms that state in memory. `metro`'s own topology is unaffected by any of this — it doesn't
know trains exist.

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

## `trainsim`: the discrete-time simulation engine

```
com.nammametro.simulation.trainsim
├── domain/model/    SimulationClock, SimulationState, TrainState, SimulationSpeed, SimulationEvent,
│                    TrainStatus, EngineSettings — pure Java records/enums
├── application/
│   ├── TickContext, TickResult, TickHandler          the pipeline contract
│   ├── tick/        ClockAdvanceHandler, TrainMovementTickHandler — pure, no Spring
│   ├── TrainSimulationEngine                         @Service, @Scheduled tick loop
│   ├── TrainSimulationControlUseCase                 in-port: start/pause/stop/reset/setSpeed/state/time
│   └── TrainSimulationEventPublisher                 out-port for broadcasting
├── infrastructure/
│   ├── TrainRosterAssembler   Postgres (roster+config) + MetroNetwork (topology) → initial SimulationState
│   └── websocket/             TrainSimulationEventPublisherAdapter — implements the out-port
└── api/rest/                  TrainSimulationController + DTOs
```

### Determinism

`TrainSimulationEngine.tick()` runs an explicitly-ordered pipeline — `ClockAdvanceHandler` then
`TrainMovementTickHandler` — composed in code, never via Spring's implicit bean-list ordering. Both
handlers are pure functions of `(SimulationState, TickContext)`: no wall-clock reads, no I/O, no
mutation of their inputs. `TrainRosterAssembler.assemble()` (called once at startup and again on
every `reset()`) is the only place external state (Postgres, `MetroNetwork`) is read — the tick loop
itself never touches either. `TrainMovementTickHandlerTest.sameInitialStateAndSeedProducesIdenticalTrajectory`
runs two independently-built initial states through 40 ticks and asserts the resulting
`SimulationState` and event lists are `.equals()` at every step — the "same network + config +
initial state + seed ⇒ same result" requirement, pinned down as a test rather than just a claim.

### Movement, headway, and events

Each train advances through `TrainStatus`'s eight values every tick — see the enum's Javadoc for the
full transition diagram. `progress` moves continuously from 0 to 1 along a track (never teleports);
speed at each point is derived from the current track's real distance/travel-time
(`(distanceMetres/1000) / (travelTimeSeconds/3600)` km/h). Headway is a simple one-train-per-track
block signal: a train ready to depart checks whether its target track is already occupied by a
train `DEPARTING`/`RUNNING`/`ARRIVING` on it; if so, it holds (`STOPPED`, then `DELAYED` past
`delayThresholdSeconds`) and re-checks every tick. That occupancy set is updated *within* the same
tick as trains are processed — not just carried over from the previous tick — so two trains whose
dwell expires simultaneously can't both claim the same block
(`TrainMovementTickHandlerTest.secondTrainIsHeldForHeadwayWhileTrackIsOccupied` pins this down).
Discrete events (`DWELL_STARTED`, `DEPARTED`, `ARRIVED`, `HELD_FOR_HEADWAY`, `DELAYED`,
`ROUTE_COMPLETED`) are collected per tick and broadcast on a separate topic from the continuous
state stream, rather than accumulated into queryable state.

Passenger demand is explicitly out of scope this chunk — `passengerCount` passes through each tick
unchanged, and `TickContext.random()` (seeded from `EngineSettings.randomSeed()`) is wired through
but unused, ready for a demand model to consume deterministically without a new dependency.

### Why trains persist in Postgres but topology doesn't

The train roster and simulation config are genuinely mutable, operator-owned configuration — which
trains exist, their capacity, their default speed — and persisting them in Postgres was the original
foundation's explicit mandate. Station/line/track topology is a large, mostly-static dataset better
served by a version-controlled JSON file loaded into a graph once (see the `metro` section above).
`trainsim` reads both, at the same startup/reset moment, but never conflates them into one model.

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

Passenger demand/generation, capacity-aware boarding/alighting, delays/disruptions beyond headway
holds, analytics, auth, and CI are out of scope. The frontend does not yet render live train
positions or the passenger-routing UI (`/api/metro/route`, `/api/simulation/*`) — this chunk's spec
scoped the simulation engine work to the backend, verified directly via REST/WebSocket rather than a
UI. Both are natural next frontend steps: `/topic/train-simulation/state` already carries everything
a map layer would need. See `docs/domain-model.md` for which domain records exist but have no
behaviour yet.
