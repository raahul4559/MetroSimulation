# Namma Metro Simulation

A Bangalore Metro (Namma Metro) simulation platform: a Next.js frontend rendering the real metro
network — backed by an in-memory graph with Dijkstra shortest-path routing — alongside a
deterministic, discrete-time train simulation engine (real movement, dwell timing, headway holds,
events) over REST and WebSocket. Passenger demand, capacity-aware boarding, disruptions, and
analytics are still ahead. See `docs/architecture.md` for why the network graph, the discrete-time
engine, and the original tick-only clock are three deliberately separate backend verticals.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- **Backend:** Spring Boot 4.1, Java 25, three verticals — `simulation` (legacy clock, Postgres),
  `metro` (network graph + routing, JSON dataset), `trainsim` (discrete-time train movement engine,
  Postgres roster/config + the metro graph's topology)
- **Database:** PostgreSQL, schema + seed managed by Flyway — the train roster and simulation config

## Project structure

```
MetroSimulation/
├── database/    Flyway migrations — Postgres schema for the train roster + simulation config
├── data/        JSON metro network dataset (stations/lines/tracks) — the routing graph's source
├── backend/     REST API, WebSocket, network graph + routing, discrete-time simulation engine
├── frontend/    Map visualization + simulation controls (see frontend/.env.example)
└── docs/        architecture.md, domain-model.md, api.md
```

## Prerequisites

- Node.js 20+ and npm
- Java 21+ (a JDK; the backend targets Java 25 but the Maven wrapper handles the rest)
- A local PostgreSQL server (no Docker required — this was built and verified against a local
  Homebrew Postgres instance)

## Setup

```bash
# 1. Database — creates role `metro_user` and database `metro_simulation`
make db-setup

# 2. Backend — applies Flyway migrations + loads the metro-network JSON dataset on startup,
#    then serves on :8080
cd backend && cp .env.example .env   # defaults already match db-setup's output
make dev-backend   # (from repo root) or: cd backend && ./mvnw spring-boot:run

# 3. Frontend — serves on :3000
cd frontend && cp .env.example .env.local
make dev-frontend   # (from repo root) or: cd frontend && npm install && npm run dev
```

Open `http://localhost:3000`. You should see the Purple/Green/Yellow line schematic (served by the
graph engine, with interchanges called out), a "Live" connection indicator, and a Simulation panel
with Start/Pause/Reset. The discrete-time train engine (`/api/simulation/*`) isn't wired into this
UI yet — drive and observe it via `curl`/WebSocket as shown below.

## Verifying

Each of these was run against a live instance while building this, not assumed:

```bash
# Database has real seed data
psql metro_simulation -c "select count(*) from stations"   # → 20
psql metro_simulation -c "select code, direction from trains"  # → 6 rows, half OUTBOUND half INBOUND

# Backend ↔ database
curl localhost:8080/actuator/health                          # → status: UP, db: UP

# Network graph (JSON-dataset-backed, no DB involved)
curl localhost:8080/api/metro/network                         # → 21 stations, 3 lines, 2 interchanges
curl "localhost:8080/api/metro/route?from=9&to=5"              # → Whitefield → Majestic, ordered stops

# Discrete-time train simulation engine
curl -X POST localhost:8080/api/simulation/start
curl -X POST "localhost:8080/api/simulation/speed?value=10"
curl localhost:8080/api/simulation/state
# → each train's progress moves continuously 0→1 across successive calls, never jumps

# Backend unit tests — network validation, routing, and the engine's tick handlers
# (the last of these asserts identical trajectories from identical inputs — the determinism
# requirement, pinned down as a test rather than a claim)
cd backend && ./mvnw test -Dtest='MetroNetworkValidationTest,DijkstraRouteFinderTest,TrainMovementTickHandlerTest'

# Frontend ↔ backend
open http://localhost:3000   # map renders from /api/metro/network, clock ticks live, no console errors
```

`make verify` runs the scriptable subset of these (health, lines, network graph, frontend reachability).

## What's next

Passenger demand/generation and capacity-aware boarding, disruption injection beyond headway holds,
and analytics are the natural next engine features — `TickContext.random()` is already wired through,
seeded and ready, for the first of these. On the frontend: rendering live train positions from
`/topic/train-simulation/state` and a trip-planner UI over `/api/metro/route` are both straightforward
next steps, since the backend contracts for both already exist and are verified. See
`docs/architecture.md` and `docs/domain-model.md` for exactly where each plugs in.
