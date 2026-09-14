package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "tracks")
public class TrackJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private LineJpaEntity line;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "from_station_id", nullable = false)
    private StationJpaEntity fromStation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "to_station_id", nullable = false)
    private StationJpaEntity toStation;

    @Column(nullable = false)
    private String direction;

    @Column(name = "length_m", nullable = false)
    private int lengthM;

    @Column(name = "max_speed_kmph", nullable = false)
    private int maxSpeedKmph;

    protected TrackJpaEntity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public LineJpaEntity getLine() {
        return line;
    }

    public StationJpaEntity getFromStation() {
        return fromStation;
    }

    public StationJpaEntity getToStation() {
        return toStation;
    }

    public String getDirection() {
        return direction;
    }

    public int getLengthM() {
        return lengthM;
    }

    public int getMaxSpeedKmph() {
        return maxSpeedKmph;
    }
}
