-- Namma Metro Simulation — core network schema.
-- Seven tables backing the domain model: lines, stations, line_stations (interchanges),
-- tracks, signals, trains, simulation_config. Passengers are runtime-only in this chunk.

CREATE TABLE lines (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    colour_hex  VARCHAR(7)   NOT NULL,
    status      VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE stations (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(32)  NOT NULL UNIQUE,
    name            VARCHAR(128) NOT NULL,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    is_interchange  BOOLEAN      NOT NULL DEFAULT FALSE,
    platform_count  INTEGER      NOT NULL DEFAULT 2
);

-- Ordered membership of a station on a line. A station appearing in more than one
-- line's sequence is, by definition, an interchange (Majestic, RV Road).
CREATE TABLE line_stations (
    id                      BIGSERIAL PRIMARY KEY,
    line_id                 BIGINT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    station_id              BIGINT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    sequence_no             INTEGER NOT NULL,
    distance_from_origin_m  INTEGER NOT NULL,
    UNIQUE (line_id, station_id),
    UNIQUE (line_id, sequence_no)
);

CREATE TABLE tracks (
    id              BIGSERIAL PRIMARY KEY,
    line_id         BIGINT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    from_station_id BIGINT NOT NULL REFERENCES stations(id),
    to_station_id   BIGINT NOT NULL REFERENCES stations(id),
    direction       VARCHAR(8) NOT NULL CHECK (direction IN ('UP', 'DOWN')),
    length_m        INTEGER NOT NULL,
    max_speed_kmph  INTEGER NOT NULL DEFAULT 80
);

CREATE TABLE signals (
    id           BIGSERIAL PRIMARY KEY,
    track_id     BIGINT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position_m   INTEGER NOT NULL,
    aspect       VARCHAR(8) NOT NULL DEFAULT 'GREEN' CHECK (aspect IN ('GREEN', 'YELLOW', 'RED'))
);

CREATE TABLE trains (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(32) NOT NULL UNIQUE,
    line_id           BIGINT NOT NULL REFERENCES lines(id),
    capacity          INTEGER NOT NULL DEFAULT 1200,
    status            VARCHAR(16) NOT NULL DEFAULT 'IDLE'
                          CHECK (status IN ('IDLE', 'IN_SERVICE', 'DWELLING', 'OUT_OF_SERVICE')),
    current_track_id  BIGINT REFERENCES tracks(id)
);

-- Single-row-per-scenario simulation configuration. `is_active` marks the scenario
-- currently loaded by the engine.
CREATE TABLE simulation_config (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(64) NOT NULL,
    tick_interval_ms    INTEGER NOT NULL DEFAULT 1000,
    time_scale          DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    dwell_time_seconds  INTEGER NOT NULL DEFAULT 30,
    headway_seconds     INTEGER NOT NULL DEFAULT 240,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_line_stations_line ON line_stations(line_id);
CREATE INDEX idx_line_stations_station ON line_stations(station_id);
CREATE INDEX idx_tracks_line ON tracks(line_id);
CREATE INDEX idx_signals_track ON signals(track_id);
CREATE INDEX idx_trains_line ON trains(line_id);
