-- Configures trainsim's passenger demand generation (PassengerDemandGenerationHandler). Additive
-- only — existing rows get safe defaults that reproduce the previous (no-passengers) behaviour's
-- traffic level under the new model.
--
-- demand_profile_mode selects which named demand regime is in effect: AUTO derives one from the
-- simulated clock's hour of day (morning/evening peaks, a night lull, flat otherwise — see
-- trainsim.domain.model.DemandProfile); pinning it to a specific profile (MORNING_PEAK, AFTERNOON,
-- EVENING_PEAK, NIGHT, CUSTOM) forces that regime regardless of simulated time. demand_multiplier
-- is an extra global scale on top of the resolved profile (and, for CUSTOM, the only scale — the
-- profile contributes no multiplier of its own).

ALTER TABLE simulation_config
    ADD COLUMN demand_profile_mode VARCHAR(16) NOT NULL DEFAULT 'AUTO'
        CHECK (demand_profile_mode IN ('AUTO', 'MORNING_PEAK', 'AFTERNOON', 'EVENING_PEAK', 'NIGHT', 'CUSTOM')),
    ADD COLUMN demand_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (demand_multiplier >= 0);
