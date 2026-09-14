package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

/** Ordered membership of a station on a line. A station on two lines is an interchange. */
@Entity
@Table(name = "line_stations")
public class LineStationJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "line_id", nullable = false)
    private LineJpaEntity line;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "station_id", nullable = false)
    private StationJpaEntity station;

    @Column(name = "sequence_no", nullable = false)
    private int sequenceNo;

    @Column(name = "distance_from_origin_m", nullable = false)
    private int distanceFromOriginM;

    protected LineStationJpaEntity() {
        // JPA
    }

    public Long getId() {
        return id;
    }

    public LineJpaEntity getLine() {
        return line;
    }

    public StationJpaEntity getStation() {
        return station;
    }

    public int getSequenceNo() {
        return sequenceNo;
    }

    public int getDistanceFromOriginM() {
        return distanceFromOriginM;
    }
}
