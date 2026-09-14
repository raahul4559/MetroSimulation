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
├── domain/
│   ├── model/       SimulationClock, SimulationState, TrainState, SimulationSpeed, SimulationEvent,
│   │                TrainStatus, EngineSettings, Signal, BlockState, SignalAspect — pure records/enums
│   └── BlockSafetyValidator                          pure, independent collision-invariant check
├── application/
│   ├── TickContext, TickResult, TickHandler          the pipeline contract
│   ├── tick/        ClockAdvanceHandler, TrainDispatcher, TrainMovementTickHandler — pure, no Spring
│   ├── TrainSimulationEngine                         @Service, @Scheduled tick loop
│   ├── TrainSimulationControlUseCase                 in-port: start/pause/stop/reset/setSpeed/state/time
│   └── TrainSimulationEventPublisher                 out-port for broadcasting
├── infrastructure/
│   ├── LineScheduleAssembler  Postgres (line_schedules+config) + MetroNetwork (topology) → initial SimulationState
│   └── websocket/             TrainSimulationEventPublisherAdapter — implements the out-port
└── api/rest/                  TrainSimulationController + DTOs (incl. SignalResponse)
```

### Determinism

`TrainSimulationEngine.tick()` runs an explicitly-ordered pipeline — `ClockAdvanceHandler`, then
`TrainDispatcher`, then `TrainMovementTickHandler` — composed in code, never via Spring's implicit
bean-list ordering. All three are pure functions of `(SimulationState, TickContext)`: no wall-clock
reads, no I/O, no mutation of their inputs. `LineScheduleAssembler.assemble()` (called once at
startup and again on every `reset()`) is the only place external state (Postgres, `MetroNetwork`) is
read — the tick loop itself never touches either. `TrainMovementTickHandlerTest.sameInitialStateAndSeedProducesIdenticalTrajectory`
runs two independently-built initial states through 120 ticks and asserts the resulting
`SimulationState` and event lists are `.equals()` at every step — the "same network + config +
initial state + seed ⇒ same result" requirement, pinned down as a test rather than just a claim.

### Scheduling and dispatch

A line's timetable is a `LineSchedule` (Postgres, `line_schedules` — see `database/README.md`): one
row per `(line, direction)`, with `firstDepartureSeconds`/`lastDepartureSeconds`/`headwaySeconds`/
`trainCount` (mutually validated — the DB `CHECK` and `LineScheduleAssembler` both reject a schedule
whose numbers disagree) plus the per-train config every generated train inherits: `capacity`,
`dwellTimeSeconds`, `maxSpeedKmph`, `accelerationMps2`, `brakingRateMps2`. None of that is hardcoded
in the engine — `LineScheduleAssembler.expand()` is what turns one schedule row into `trainCount`
individual `TrainState`s (auto-coded per line, e.g. Purple → `P01`, `P02`, ... across both
directions), each starting `TrainStatus.SCHEDULED` with its own `scheduledDepartureSeconds`. Starting
station is never separately authored — it's always the terminus the schedule's `direction` points
away from, the same derive-don't-duplicate approach `metro` uses for station type.

`TrainDispatcher` is what actually starts a train at its scheduled time: each tick it checks every
`SCHEDULED` train's `scheduledDepartureSeconds` against the clock's `elapsedSimulationSeconds` and
flips it to `AT_STATION` (emitting `DISPATCHED`) the moment it's due — nothing before that. It runs
immediately after the clock and before movement, so a train dispatched this tick is already eligible
to begin dwelling/departing (headway-checked against every other train) on the very same tick.

### Movement, headway, and events

Each train advances through `TrainStatus`'s nine values every tick — see the enum's Javadoc for the
full transition diagram (now starting from `SCHEDULED`, `TrainDispatcher`'s entry point). `progress`
moves continuously from 0 to 1 along a track (never teleports); speed is real per-train kinematics,
not a flat distance/time average — `TrainMovementTickHandler.advanceAlongTrack()` accelerates toward
the train's effective max speed (see "Signaling and block sections" below) at its `accelerationMps2`
unless the remaining distance is inside the braking distance needed to stop at the platform
(`v² / (2 × brakingRateMps2)`), in which case it decelerates at `brakingRateMps2` instead — a
standard trapezoidal accel/cruise/brake profile, integrated tick-by-tick as a trapezoidal-average of
start/end-of-tick speed. Discrete events (`DISPATCHED`, `DWELL_STARTED`, `DEPARTED`, `ARRIVED`,
`HELD_FOR_HEADWAY`, `DELAYED`, `ROUTE_COMPLETED`) are collected per tick and broadcast on a separate
topic from the continuous state stream, rather than accumulated into queryable state.

Passenger demand is explicitly out of scope this chunk — `passengerCount` passes through each tick
unchanged, and `TickContext.random()` (seeded from `EngineSettings.randomSeed()`) is wired through
but unused, ready for a demand model to consume deterministically without a new dependency.

### Signaling and block sections

Each track is one logical block — dividing tracks any finer would need sub-track train positions the
rest of the engine doesn't have, and the spec explicitly asks for understandable modeling over
real-world signaling complexity. `TrainMovementTickHandler` computes a `BlockState`
(`FREE`/`RESERVED`/`OCCUPIED`) for every block each tick, in a local `BlockBoard` snapshotted from
the incoming trains and mutated as trains are processed — the same one-train-per-block bookkeeping
the engine always had, just promoted to an explicit, testable model instead of a bare `Set<Long>`. A
train transitions its block to `RESERVED` for the single tick it's granted departure (`DEPARTING`),
then `OCCUPIED` for as long as it's physically in it (`RUNNING`/`ARRIVING`); a train ready to depart
checks `board.isFree(trackId)` first and holds (`STOPPED`, then `DELAYED` past
`delayThresholdSeconds` — exposed to the API as `delaySeconds`) if not. That board is updated *within*
the same tick as trains are processed — not just carried over from the previous tick — so two trains
whose dwell expires simultaneously can't both claim the same block
(`TrainMovementTickHandlerTest.secondTrainIsHeldForHeadwayWhileTrackIsOccupied` pins this down). This
*is* the engine's headway and safe-stopping-distance story: a train physically cannot be granted a
block another train already holds, and every train brakes to a full stop at every platform by
construction (real metro operation — no track segment is a through-run), so "signal red → brake →
stop → signal green → resume" falls out of existing platform-stop physics rather than needing a
second, parallel braking model.

Each block's `Signal` (`SignalAspect`: `RED`/`YELLOW`/`GREEN`, one-to-one with its `BlockState` —
`FREE`→`GREEN`, `RESERVED`→`YELLOW`, `OCCUPIED`→`RED`) is derived from that same board at the end of
the tick and attached to `SimulationState.signals()` — not independent state, just like `TrainState`
itself. `Signal.protectedSectionId` and `trackId` are always equal in this one-block-per-track model;
kept as two fields to mirror the spec's literal shape rather than assuming a future, less-simplified
model must coincide the two. The one genuinely dynamic *speed* behavior — "speed restriction" /
"following-train control" — is `effectiveMaxSpeedMps()`: a train's cruising speed is capped to half
its `maxSpeedKmph` whenever the block *after* the one it's currently on isn't `FREE`, modeling a
train restraining its approach rather than rushing up to a possibly-busy platform. It's a soft
cruise-speed cap, not a safety gate — the hard "can't enter an occupied block" guarantee is the block
board, not this.

`BlockSafetyValidator` (pure, `trainsim.domain`) checks the actual collision invariant independently
of the handler that's supposed to uphold it: no two trains report the same `currentTrackId` while
both are physically in that block. `TrainSimulationEngine.tick()` logs a warning if it ever fires (it
shouldn't); `BlockSafetyValidatorTest.manyTrainsQueuingForTheSameBlocksNeverShareOne` stress-tests six
trains funneling through three single-track blocks for up to 400 ticks, validating after *every* tick
— "two trains cannot occupy the same protected section simultaneously," pinned down as a test that
can fail, not just a comment that can drift out of date.

### Why schedules (and trains) persist in Postgres but topology doesn't

Line schedules, and the trains they generate, are genuinely mutable, operator-owned configuration —
which lines run, how often, with what train specs — and persisting them in Postgres was the original
foundation's explicit mandate (the old static `trains` table this superseded is left in place,
unused, same as other superseded-but-kept legacy pieces). Station/line/track topology is a large,
mostly-static dataset better served by a version-controlled JSON file loaded into a graph once (see
the `metro` section above). `trainsim` reads both, at the same startup/reset moment, but never
conflates them into one model.

## Frontend: no simulation or routing logic in components

```
frontend/src/
├── domain/
│   ├── metro/      TypeScript interfaces mirroring the metro API — the map's data contract
│   ├── trainsim/   TypeScript interfaces mirroring /api/simulation — TrainState, Signal,
│   │               SimulationClock/State/Event
│   ├── simulation.ts, train.ts   mirroring the legacy simulation-clock API
├── lib/
│   ├── api/        client.ts (three base URLs: /api/v1, /api/metro, /api/simulation), per-context clients
│   ├── ws/         STOMP WebSocket clients, independent of React (one per backend engine)
│   ├── geometry/   pure lat/lng → SVG (x, y) projection, path-building, and pan/zoom-transform math
│   └── metro/      pure derivations over network + train data: neighbor stations, label/line
│                   visibility rules, train-position interpolation, train status display strings,
│                   the debug-mode block chain (current/next block lookahead, mirroring the backend's)
├── hooks/          bridges lib/* into React state (useNetwork, useTrainSimulation,
│                   useTrainSimulationSocket, useMapViewport, useLineVisibility, ...)
└── components/     presentational — map, trains, controls, network, ui
```

`useNetwork` calls `/api/metro/network` (one call, the full graph). `components/map/MetroMap.tsx`
never computes a coordinate itself; it calls `buildProjector()` from `lib/geometry` and renders
whatever it returns — the map component doesn't know or care whether a station is real-world-projected
or manually laid out. Line visibility is lifted out of `MetroMap` into the page (`useLineVisibility`)
so the map's own toggles and the sidebar's `LineFilter`/`TrainList` share one set of hidden line
codes; train selection is lifted the same way so clicking a train in `TrainList` can drive
`MetroMap`'s `useMapViewport().focusOn()` — a one-shot pan/zoom to that train's current interpolated
position, not a continuous camera-follow. `lib/metro/trainPosition.ts#interpolateTrainPoint` is the
one place a `TrainState`'s `previousStationId`/`nextStationId`/`progress` become an (x, y): it
linearly interpolates between the two stations' projected points, matching what the backend's own
`progress` already represents (continuous position along the current track, never teleporting).
`signalAnchorPoint` (same file) places a block's `SignalMarker` near its origin station rather than
at the track's midpoint — a signal stands at the entrance to the block it protects.

`components/trains/TrainDetails.tsx` has a "Debug mode" checkbox (local state — nothing else needs
it) that reveals the literal chain the spec asks for: Train → Current block → Next block → Signal →
Signal state. `lib/metro/blockChain.ts#computeBlockChain` computes the current/next block ids the
same way the backend's `TrainMovementTickHandler.downstreamTrackId()` does (walk the line's ordered
stations in the train's direction, find the track after the one it's headed to) — a second
implementation of the same lookahead, kept deliberately simple and side-by-side rather than shared
across the Java/TypeScript boundary.

## Why a schematic (not geographic) map

The map is a projected SVG diagram, not a tile-based map — no map provider, no API key, and the
projection math is trivial to reason about and test. Stations still store real `latitude`/`longitude`;
`lib/geometry/projection.ts` is the one place that turns them into pixels, so a geographic (tile-based)
renderer is an additive change later, not a data model change.

## Explicitly deferred

Passenger demand/generation, capacity-aware boarding/alighting, delays/disruptions beyond headway
holds, analytics, auth, and CI are out of scope. `passengerCount` renders in the UI wherever a train
shows it, but it's always `0` — a real demand model is a future chunk, not this one. The
passenger-routing UI (`/api/metro/route`) also isn't wired into the frontend yet — out of scope for
this chunk's spec, which was the map's train layer, not trip planning. See `docs/domain-model.md` for
which domain records exist but have no behaviour yet.
