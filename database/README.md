# Database

PostgreSQL schema and seed data for the Namma Metro Simulation. Flyway (run by the Spring Boot
backend) is the migration engine; the SQL files in `migrations/` are the single source of truth for
the schema — the backend's `pom.xml` maps this directory onto its classpath rather than duplicating
the SQL.

## Setup

Requires a local PostgreSQL server (tested against Postgres 16 via Homebrew).

```bash
./setup.sh
```

Idempotent — creates role `metro_user` (password `metro_password`, override via `DB_USER` /
`DB_PASSWORD` / `DB_NAME` env vars) and database `metro_simulation` owned by it. Never drops or
modifies existing data. The actual schema and seed rows are applied by Flyway when the backend
starts (see `backend/`), not by this script.

## Schema

Seven tables, one per persisted domain entity (see `docs/domain-model.md` for the full picture):

- `lines`, `stations`, `line_stations` (ordered line membership — a station on two lines is an
  interchange), `tracks` (directional segments between adjacent stations), `signals`, `trains`,
  `simulation_config`.

`passengers` deliberately has **no table** yet — passengers are generated and consumed entirely
in-memory by the simulation engine. A table will be added only if/when passenger history needs to
persist across restarts.

## Seed data

`V2__seed_namma_metro_network.sql` seeds a representative ~20-station subset of the real Namma
Metro network across the Purple, Green, and Yellow lines, including the real interchanges at
**Majestic** (Purple ↔ Green) and **RV Road** (Green ↔ Yellow). Station names and relative ordering
are accurate; latitude/longitude values are approximate (plausible, not survey-grade) since they
only feed the frontend's schematic projection in this chunk. Replace them with precise coordinates
before any geographic (tile-based) map is built on top of this data.
