package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

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
}
