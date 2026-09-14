package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "stations")
public class StationJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(name = "is_interchange", nullable = false)
    private boolean interchange;

    @Column(name = "platform_count", nullable = false)
    private int platformCount;

    protected StationJpaEntity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public boolean isInterchange() {
        return interchange;
    }

    public int getPlatformCount() {
        return platformCount;
    }
}
