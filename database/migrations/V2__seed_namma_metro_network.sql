-- Seed data: a representative subset of the real Namma Metro network.
-- Coordinates are approximate (plausible, not survey-grade) — see database/README.md.
-- Kept intentionally small: ~20 stations across 3 lines, with real interchanges
-- (Majestic: Purple/Green, RV Road: Green/Yellow) so the schematic map has real
-- topology to render, without seeding the full ~90-station network.

INSERT INTO lines (code, name, colour_hex, status) VALUES
    ('PURPLE', 'Purple Line', '#92278F', 'ACTIVE'),
    ('GREEN',  'Green Line',  '#00A651', 'ACTIVE'),
    ('YELLOW', 'Yellow Line', '#FDB913', 'ACTIVE');

INSERT INTO stations (code, name, latitude, longitude, is_interchange, platform_count) VALUES
    ('KENGERI',            'Kengeri',                       12.9081, 77.4855, FALSE, 2),
    ('NAYANDAHALLI',       'Nayandahalli',                  12.9435, 77.5348, FALSE, 2),
    ('VIJAYANAGAR',        'Vijayanagar',                   12.9719, 77.5326, FALSE, 2),
    ('MAGADI_ROAD',        'Magadi Road',                   12.9767, 77.5624, FALSE, 2),
    ('MAJESTIC',           'Majestic (Kempegowda)',         12.9767, 77.5713, TRUE,  4),
    ('MG_ROAD',            'MG Road',                       12.9758, 77.6055, FALSE, 2),
    ('INDIRANAGAR',        'Indiranagar',                   12.9784, 77.6408, FALSE, 2),
    ('BAIYAPPANAHALLI',    'Baiyappanahalli',               12.9911, 77.6530, FALSE, 2),
    ('NAGASANDRA',         'Nagasandra',                    13.0453, 77.5115, FALSE, 2),
    ('YESHWANTPUR',        'Yeshwantpur',                   13.0284, 77.5546, FALSE, 2),
    ('MAHALAKSHMI',        'Mahalakshmi',                   13.0119, 77.5563, FALSE, 2),
    ('LALBAGH',            'Lalbagh',                       12.9507, 77.5848, FALSE, 2),
    ('JAYANAGAR',          'Jayanagar',                     12.9308, 77.5838, FALSE, 2),
    ('RV_ROAD',            'RV Road',                       12.9421, 77.5764, TRUE,  4),
    ('YELACHENAHALLI',     'Yelachenahalli',                12.8887, 77.5722, FALSE, 2),
    ('JAYADEVA_HOSPITAL',  'Jayadeva Hospital',             12.9186, 77.5988, FALSE, 2),
    ('CENTRAL_SILK_BOARD', 'Central Silk Board',            12.9172, 77.6228, FALSE, 2),
    ('ELECTRONIC_CITY',    'Electronic City',               12.8452, 77.6602, FALSE, 2),
    ('HEBBAGODI',          'Hebbagodi',                     12.8112, 77.6774, FALSE, 2),
    ('BOMMASANDRA',        'Bommasandra',                   12.8006, 77.6910, FALSE, 2);

-- Purple Line: Kengeri -> Baiyappanahalli (west to east, via Majestic)
INSERT INTO line_stations (line_id, station_id, sequence_no, distance_from_origin_m)
SELECT l.id, s.id, seq.sequence_no, seq.distance_m
FROM (VALUES
    ('KENGERI',         1, 0),
    ('NAYANDAHALLI',    2, 5400),
    ('VIJAYANAGAR',     3, 8100),
    ('MAGADI_ROAD',     4, 10800),
    ('MAJESTIC',        5, 12600),
    ('MG_ROAD',         6, 16200),
    ('INDIRANAGAR',     7, 20700),
    ('BAIYAPPANAHALLI', 8, 23400)
) AS seq(station_code, sequence_no, distance_m)
JOIN stations s ON s.code = seq.station_code
JOIN lines l ON l.code = 'PURPLE';

-- Green Line: Nagasandra -> Yelachenahalli (north to south, via Majestic)
INSERT INTO line_stations (line_id, station_id, sequence_no, distance_from_origin_m)
SELECT l.id, s.id, seq.sequence_no, seq.distance_m
FROM (VALUES
    ('NAGASANDRA',      1, 0),
    ('YESHWANTPUR',     2, 5200),
    ('MAHALAKSHMI',     3, 7400),
    ('MAJESTIC',        4, 10900),
    ('LALBAGH',         5, 14600),
    ('JAYANAGAR',       6, 17300),
    ('RV_ROAD',         7, 19100),
    ('YELACHENAHALLI',  8, 24800)
) AS seq(station_code, sequence_no, distance_m)
JOIN stations s ON s.code = seq.station_code
JOIN lines l ON l.code = 'GREEN';

-- Yellow Line: RV Road -> Bommasandra (north to south)
INSERT INTO line_stations (line_id, station_id, sequence_no, distance_from_origin_m)
SELECT l.id, s.id, seq.sequence_no, seq.distance_m
FROM (VALUES
    ('RV_ROAD',            1, 0),
    ('JAYADEVA_HOSPITAL',  2, 3100),
    ('CENTRAL_SILK_BOARD', 3, 5900),
    ('ELECTRONIC_CITY',    4, 15200),
    ('HEBBAGODI',          5, 19800),
    ('BOMMASANDRA',        6, 22100)
) AS seq(station_code, sequence_no, distance_m)
JOIN stations s ON s.code = seq.station_code
JOIN lines l ON l.code = 'YELLOW';

-- Tracks: one UP and one DOWN segment between every consecutive station pair on each line.
INSERT INTO tracks (line_id, from_station_id, to_station_id, direction, length_m, max_speed_kmph)
SELECT
    a.line_id,
    a.station_id,
    b.station_id,
    'UP',
    b.distance_from_origin_m - a.distance_from_origin_m,
    80
FROM line_stations a
JOIN line_stations b ON a.line_id = b.line_id AND b.sequence_no = a.sequence_no + 1;

INSERT INTO tracks (line_id, from_station_id, to_station_id, direction, length_m, max_speed_kmph)
SELECT
    b.line_id,
    b.station_id,
    a.station_id,
    'DOWN',
    b.distance_from_origin_m - a.distance_from_origin_m,
    80
FROM line_stations a
JOIN line_stations b ON a.line_id = b.line_id AND b.sequence_no = a.sequence_no + 1;

-- One mid-block signal per track, all green (idle network).
INSERT INTO signals (track_id, position_m, aspect)
SELECT id, length_m / 2, 'GREEN' FROM tracks;

-- Two trains per line, idle, not yet placed on a track.
INSERT INTO trains (code, line_id, capacity, status, current_track_id)
SELECT t.code, l.id, 1200, 'IDLE', NULL
FROM (VALUES
    ('PL-01', 'PURPLE'), ('PL-02', 'PURPLE'),
    ('GL-01', 'GREEN'),  ('GL-02', 'GREEN'),
    ('YL-01', 'YELLOW'), ('YL-02', 'YELLOW')
) AS t(code, line_code)
JOIN lines l ON l.code = t.line_code;

INSERT INTO simulation_config (name, tick_interval_ms, time_scale, dwell_time_seconds, headway_seconds, is_active)
VALUES ('Default Scenario', 1000, 1.0, 30, 240, TRUE);
