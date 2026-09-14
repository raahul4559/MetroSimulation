# Namma Metro Simulation

Foundation for a Bangalore Metro (Namma Metro) simulation platform: a Next.js frontend rendering the
real metro network from a Spring Boot API, backed by PostgreSQL, with a live WebSocket simulation
clock. **This is the foundation chunk only** — no train movement, dwell timing, passenger simulation,
signalling, or analytics yet. See `docs/architecture.md` for the extension points those will plug
into.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4
- **Backend:** Spring Boot 4.1, Java 25, hexagonal layering (`domain` / `application` / `infrastructure` / `api`)
- **Database:** PostgreSQL, schema + seed managed by Flyway

## Project structure

```
MetroSimulation/
├── database/    Flyway migrations (schema + real Namma Metro seed data) + local setup script
├── backend/     REST API, WebSocket, simulation clock (see backend/.env.example)
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

# 2. Backend — applies Flyway migrations on startup, then serves on :8080
cd backend && cp .env.example .env   # defaults already match db-setup's output
make dev-backend   # (from repo root) or: cd backend && ./mvnw spring-boot:run

# 3. Frontend — serves on :3000
cd frontend && cp .env.example .env.local
make dev-frontend   # (from repo root) or: cd frontend && npm install && npm run dev
```

Open `http://localhost:3000`. You should see the Purple/Green/Yellow line schematic with real
station names, a "Live" connection indicator, and a Simulation panel with Start/Pause/Reset.

## Verifying the foundation

Each of these was run against a live instance while building this chunk, not assumed:

```bash
# Database has real seed data
psql metro_simulation -c "select count(*) from stations"   # → 20
psql metro_simulation -c "select code from lines"           # → PURPLE, GREEN, YELLOW

# Backend ↔ database
curl localhost:8080/actuator/health                          # → status: UP, db: UP

# REST
curl localhost:8080/api/v1/network/lines                     # → 3 lines, ordered stations
curl localhost:8080/api/v1/network/stations/NOPE              # → 404 ProblemDetail

# Simulation control + WebSocket
curl -X POST localhost:8080/api/v1/simulation/start
curl localhost:8080/api/v1/simulation                         # → currentTick increasing

# Frontend ↔ backend
open http://localhost:3000   # map renders, clock ticks live, no console errors
```

`make verify` runs the scriptable subset of these (health, lines, frontend reachability).

## What's next

Train movement, dwell timing, multi-train scheduling, passenger generation, capacity, signalling and
headways, delays/disruptions, and analytics — each plugs into the `TickHandler` seam in
`SimulationEngine` (backend) without touching the REST/WebSocket layer or the frontend's rendering
components. See `docs/architecture.md` and `docs/domain-model.md` for exactly where.
