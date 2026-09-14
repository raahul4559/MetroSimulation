package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "trains")
public class TrainJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private LineJpaEntity line;

    @Column(nullable = false)
    private int capacity;

    @Column(nullable = false)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_track_id")
    private TrackJpaEntity currentTrack;

    @Column(nullable = false)
    private String direction;

    protected TrainJpaEntity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public LineJpaEntity getLine() {
        return line;
    }

    public int getCapacity() {
        return capacity;
    }

    public String getStatus() {
        return status;
    }

    public TrackJpaEntity getCurrentTrack() {
        return currentTrack;
    }

    public String getDirection() {
        return direction;
    }
}
