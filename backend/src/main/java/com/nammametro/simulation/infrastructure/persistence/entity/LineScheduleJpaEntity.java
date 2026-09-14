package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "line_schedules")
public class LineScheduleJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private LineJpaEntity line;

    @Column(nullable = false)
    private String direction;

    @Column(name = "first_departure_seconds", nullable = false)
    private int firstDepartureSeconds;

    @Column(name = "last_departure_seconds", nullable = false)
    private int lastDepartureSeconds;

    @Column(name = "headway_seconds", nullable = false)
    private int headwaySeconds;

    @Column(name = "train_count", nullable = false)
    private int trainCount;

    @Column(name = "dwell_time_seconds", nullable = false)
    private int dwellTimeSeconds;

    @Column(nullable = false)
    private int capacity;

    @Column(name = "max_speed_kmph", nullable = false)
    private double maxSpeedKmph;

    @Column(name = "acceleration_mps2", nullable = false)
    private double accelerationMps2;

    @Column(name = "braking_rate_mps2", nullable = false)
    private double brakingRateMps2;

    protected LineScheduleJpaEntity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public LineJpaEntity getLine() {
        return line;
    }

    public String getDirection() {
        return direction;
    }

    public int getFirstDepartureSeconds() {
        return firstDepartureSeconds;
    }

    public int getLastDepartureSeconds() {
        return lastDepartureSeconds;
    }

    public int getHeadwaySeconds() {
        return headwaySeconds;
    }

    public int getTrainCount() {
        return trainCount;
    }

    public int getDwellTimeSeconds() {
        return dwellTimeSeconds;
    }

    public int getCapacity() {
        return capacity;
    }

    public double getMaxSpeedKmph() {
        return maxSpeedKmph;
    }

    public double getAccelerationMps2() {
        return accelerationMps2;
    }

    public double getBrakingRateMps2() {
        return brakingRateMps2;
    }
}
