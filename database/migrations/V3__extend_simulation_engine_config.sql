-- Extends simulation_config and trains with what the discrete-time simulation engine
-- (com.nammametro.simulation.trainsim) needs as deterministic, persisted input.
-- Additive only — existing columns/rows are untouched, new columns get safe defaults.

ALTER TABLE simulation_config
    ADD COLUMN start_time TIMESTAMPTZ NOT NULL DEFAULT '2026-01-01T05:00:00Z',
    ADD COLUMN base_sim_seconds_per_tick INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN delay_threshold_seconds INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN random_seed BIGINT NOT NULL DEFAULT 42;

-- time_scale already exists (V1) and doubles as the default simulation speed multiplier;
-- headway_seconds already exists (V1) and doubles as the minimum headway between trains.

ALTER TABLE trains
    ADD COLUMN direction VARCHAR(16) NOT NULL DEFAULT 'OUTBOUND'
        CHECK (direction IN ('OUTBOUND', 'INBOUND'));

-- Half the existing 2-per-line roster runs the reverse direction, so each line has service
-- in both directions.
UPDATE trains SET direction = 'INBOUND' WHERE code IN ('PL-02', 'GL-02', 'YL-02');
