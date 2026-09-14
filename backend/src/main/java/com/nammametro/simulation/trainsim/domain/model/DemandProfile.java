package com.nammametro.simulation.trainsim.domain.model;

/**
 * A named passenger-demand regime. Also doubles as {@code simulation_config.demand_profile_mode}'s
 * type: {@code AUTO} picks a profile from the simulated clock's hour-of-day (see {@link #forHour}),
 * anything else forces that profile regardless of time — useful for testing "what if it's always
 * evening peak" without waiting for the clock to get there. {@code CUSTOM} ignores
 * {@link #baseMultiplier} entirely in favor of {@code EngineSettings#demandMultiplier()} — a single
 * operator-supplied number, not a canned peak/off-peak curve.
 *
 * <p>{@code baseMultiplier} scales every station's base hourly arrival rate up or down; it does not
 * itself vary by station — that comes from each station's {@code StationType} (see
 * {@code PassengerDemandGenerationHandler}), which is what makes demand vary by station on top of
 * varying by time of day.
 */
public enum DemandProfile {
    AUTO(1.0),
    MORNING_PEAK(2.5),
    AFTERNOON(1.0),
    EVENING_PEAK(2.5),
    NIGHT(0.2),
    CUSTOM(1.0);

    private final double baseMultiplier;

    DemandProfile(double baseMultiplier) {
        this.baseMultiplier = baseMultiplier;
    }

    /** The profile's own multiplier — meaningless for {@code AUTO} (never used un-resolved) and for
     * {@code CUSTOM} (callers use {@code EngineSettings#demandMultiplier()} instead). */
    public double baseMultiplier() {
        return baseMultiplier;
    }

    /** Bengaluru-typical bands: morning/evening commute peaks, a late-night/early-morning lull,
     * flat mid-day/off-peak otherwise. Purely a function of {@code hourOfDay} (0-23) — never reads
     * wall-clock time itself, so it stays deterministic given the simulation's own {@code Instant}. */
    public static DemandProfile forHour(int hourOfDay) {
        if (hourOfDay >= 7 && hourOfDay < 10) {
            return MORNING_PEAK;
        }
        if (hourOfDay >= 17 && hourOfDay < 20) {
            return EVENING_PEAK;
        }
        if (hourOfDay >= 22 || hourOfDay < 5) {
            return NIGHT;
        }
        return AFTERNOON;
    }

    /** Resolves a configured mode (possibly {@code AUTO}) against the simulated hour into the
     * concrete profile actually in effect this tick. */
    public DemandProfile resolve(int hourOfDay) {
        return this == AUTO ? forHour(hourOfDay) : this;
    }
}
