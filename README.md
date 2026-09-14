# Namma Metro Simulation

A Bangalore Metro (Namma Metro) simulation platform: a Next.js frontend rendering the real metro
network — now backed by an in-memory graph with Dijkstra shortest-path routing — alongside a
PostgreSQL-backed simulation clock over WebSocket. No train movement, dwell timing, passenger
simulation, signalling, or analytics yet. See `docs/architecture.md` for the extension points those
will plug into, and for why the network graph and the simulation clock are deliberately two separate
backend modules.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- **Backend:** Spring Boot 4.1, Java 25, two hexagonal-layered modules — `simulation` (clock, trains,
  Postgres) and `metro` (network graph, routing, JSON dataset)
- **Database:** PostgreSQL, schema + seed managed by Flyway — used by `simulation` only

## Project structure

```
MetroSimulation/
├── database/    Flyway migrations — Postgres schema for the simulation clock/trains
├── data/        JSON metro network dataset (stations/lines/tracks) — the routing graph's source
├── backend/     REST API, WebSocket, network graph + routing, simulation clock
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

Open `http://localhost:3000`. You should see the Purple/Green/Yellow line schematic (now served by
the graph engine, with interchanges called out), a "Live" connection indicator, and a Simulation
panel with Start/Pause/Reset.

## Verifying

Each of these was run against a live instance while building this, not assumed:

```bash
# Database has real seed data (simulation clock's Postgres store)
psql metro_simulation -c "select count(*) from stations"   # → 20
psql metro_simulation -c "select code from lines"           # → PURPLE, GREEN, YELLOW

# Backend ↔ database
curl localhost:8080/actuator/health                          # → status: UP, db: UP

# Network graph (JSON-dataset-backed, no DB involved)
curl localhost:8080/api/metro/network                         # → 21 stations, 3 lines, 2 interchanges
curl "localhost:8080/api/metro/route?from=9&to=5"              # → Whitefield → Majestic, ordered stops
curl localhost:8080/api/metro/stations/9999                    # → 404 ProblemDetail

# Simulation clock (Postgres + WebSocket)
curl -X POST localhost:8080/api/v1/simulation/start
curl localhost:8080/api/v1/simulation                          # → currentTick increasing

# Backend unit tests — MetroNetwork validation + Dijkstra routing, no Spring context needed
cd backend && ./mvnw test -Dtest='MetroNetworkValidationTest,DijkstraRouteFinderTest'

# Frontend ↔ backend
open http://localhost:3000   # map renders from /api/metro/network, clock ticks live, no console errors
```

`make verify` runs the scriptable subset of these (health, lines, frontend reachability).

## What's next

Train movement, dwell timing, multi-train scheduling, passenger generation, capacity, signalling and
headways, delays/disruptions, and analytics — each plugs into the `TickHandler` seam in
`SimulationEngine` without touching the REST/WebSocket layer or the frontend's rendering components.
A trip-planner UI over the already-working `/api/metro/route` endpoint is a natural next frontend
step. See `docs/architecture.md` and `docs/domain-model.md` for exactly where.
