package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "simulation_config")
public class SimulationConfigJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "tick_interval_ms", nullable = false)
    private int tickIntervalMs;

    @Column(name = "time_scale", nullable = false)
    private double timeScale;

    @Column(name = "dwell_time_seconds", nullable = false)
    private int dwellTimeSeconds;

    @Column(name = "headway_seconds", nullable = false)
    private int headwaySeconds;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "base_sim_seconds_per_tick", nullable = false)
    private int baseSimSecondsPerTick;

    @Column(name = "delay_threshold_seconds", nullable = false)
    private int delayThresholdSeconds;

    @Column(name = "random_seed", nullable = false)
    private long randomSeed;

    protected SimulationConfigJpaEntity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public int getTickIntervalMs() {
        return tickIntervalMs;
    }

    public double getTimeScale() {
        return timeScale;
    }

    public int getDwellTimeSeconds() {
        return dwellTimeSeconds;
    }

    public int getHeadwaySeconds() {
        return headwaySeconds;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public int getBaseSimSecondsPerTick() {
        return baseSimSecondsPerTick;
    }

    public int getDelayThresholdSeconds() {
        return delayThresholdSeconds;
    }

    public long getRandomSeed() {
        return randomSeed;
    }
}
