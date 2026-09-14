package com.nammametro.simulation.infrastructure.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "lines")
public class LineJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(name = "colour_hex", nullable = false)
    private String colourHex;

    @Column(nullable = false)
    private String status;

    protected LineJpaEntity() {
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

    public String getColourHex() {
        return colourHex;
    }

    public String getStatus() {
        return status;
    }
}
