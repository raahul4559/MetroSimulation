package com.nammametro.simulation.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Backs the {@code simulation.*} keys in application.yml; also read directly via SpEL for @Scheduled. */
@ConfigurationProperties(prefix = "simulation")
public record SimulationProperties(int tickIntervalMs, double timeScale) {
}
