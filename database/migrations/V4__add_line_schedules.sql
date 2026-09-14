-- Per-line, per-direction timetables driving trainsim's TrainDispatcher: how many trains run,
-- when the first/last one leaves, and the headway between them. Additive only.
--
-- first_departure_seconds/last_departure_seconds are offsets from simulation_config.start_time,
-- not wall-clock times. The CHECK below keeps first/last/headway/count mutually consistent —
-- a schedule can't claim a last-departure time that disagrees with its own headway and count.

CREATE TABLE line_schedules (
    id                       BIGSERIAL PRIMARY KEY,
    line_id                  BIGINT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    direction                VARCHAR(16) NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
    first_departure_seconds  INTEGER NOT NULL CHECK (first_departure_seconds >= 0),
    last_departure_seconds   INTEGER NOT NULL,
    headway_seconds          INTEGER NOT NULL CHECK (headway_seconds > 0),
    train_count              INTEGER NOT NULL CHECK (train_count > 0),
    dwell_time_seconds       INTEGER NOT NULL CHECK (dwell_time_seconds > 0),
    capacity                 INTEGER NOT NULL CHECK (capacity > 0),
    max_speed_kmph           DOUBLE PRECISION NOT NULL CHECK (max_speed_kmph > 0),
    acceleration_mps2        DOUBLE PRECISION NOT NULL CHECK (acceleration_mps2 > 0),
    braking_rate_mps2        DOUBLE PRECISION NOT NULL CHECK (braking_rate_mps2 > 0),
    UNIQUE (line_id, direction),
    CHECK (last_departure_seconds = first_departure_seconds + headway_seconds * (train_count - 1))
);

CREATE INDEX idx_line_schedules_line ON line_schedules(line_id);

-- Purple gets 3 trains/direction, Green and Yellow 2/direction, all on a 5-minute headway —
-- matches the spec's worked example (Purple: P01-P03, Green: G01-G02) once expanded by
-- trainsim.infrastructure.LineScheduleAssembler.
INSERT INTO line_schedules (
    line_id, direction, first_departure_seconds, last_departure_seconds, headway_seconds,
    train_count, dwell_time_seconds, capacity, max_speed_kmph, acceleration_mps2, braking_rate_mps2
)
SELECT l.id, v.direction, v.first_dep, v.last_dep, v.headway, v.count, v.dwell, v.capacity,
       v.max_speed, v.accel, v.brake
FROM (VALUES
    ('PURPLE', 'OUTBOUND', 0, 600, 300, 3, 30, 1200, 80.0, 1.0, 1.2),
    ('PURPLE', 'INBOUND',  0, 600, 300, 3, 30, 1200, 80.0, 1.0, 1.2),
    ('GREEN',  'OUTBOUND', 0, 300, 300, 2, 30, 1200, 80.0, 1.0, 1.2),
    ('GREEN',  'INBOUND',  0, 300, 300, 2, 30, 1200, 80.0, 1.0, 1.2),
    ('YELLOW', 'OUTBOUND', 0, 300, 300, 2, 30, 1000, 80.0, 1.0, 1.2),
    ('YELLOW', 'INBOUND',  0, 300, 300, 2, 30, 1000, 80.0, 1.0, 1.2)
) AS v(line_code, direction, first_dep, last_dep, headway, count, dwell, capacity, max_speed, accel, brake)
JOIN lines l ON l.code = v.line_code;
