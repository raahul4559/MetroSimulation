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

Eight tables, one per persisted domain entity (see `docs/domain-model.md` for the full picture):

- `lines`, `stations`, `line_stations` (ordered line membership — a station on two lines is an
  interchange), `tracks` (directional segments between adjacent stations), `signals`, `trains`,
  `simulation_config`, `line_schedules`.

`passengers` deliberately has **no table** yet — passengers are generated and consumed entirely
in-memory by the simulation engine. A table will be added only if/when passenger history needs to
persist across restarts.

`V3__extend_simulation_engine_config.sql` is additive-only (safe defaults, no data loss): adds
`start_time`, `base_sim_seconds_per_tick`, `delay_threshold_seconds`, `random_seed` to
`simulation_config`, and `direction` (`OUTBOUND`/`INBOUND`) to `trains`. These feed the discrete-time
simulation engine (`com.nammametro.simulation.trainsim`); `time_scale` and `headway_seconds` (from
V1) are reused as the engine's default speed and minimum headway rather than adding duplicate
columns.

`V4__add_line_schedules.sql` adds `line_schedules` — one row per `(line, direction)` timetable
(first/last departure, headway, train count, plus the per-train capacity/speed/acceleration/braking/
dwell config every train it generates inherits). This is what `trainsim` now reads at startup/reset
to build its roster (`trainsim.infrastructure.LineScheduleAssembler`), superseding `trains` as the
roster source — `trains` itself is left in place, unread by `trainsim`, same as other superseded
legacy pieces. See `docs/domain-model.md` for the full field-by-field breakdown and
`docs/architecture.md`'s "Scheduling and dispatch" for how a schedule row becomes N running trains.

## Seed data

`V2__seed_namma_metro_network.sql` seeds a representative ~20-station subset of the real Namma
Metro network across the Purple, Green, and Yellow lines, including the real interchanges at
**Majestic** (Purple ↔ Green) and **RV Road** (Green ↔ Yellow). Station names and relative ordering
are accurate; latitude/longitude values are approximate (plausible, not survey-grade) since they
only feed the frontend's schematic projection in this chunk. Replace them with precise coordinates
before any geographic (tile-based) map is built on top of this data.
