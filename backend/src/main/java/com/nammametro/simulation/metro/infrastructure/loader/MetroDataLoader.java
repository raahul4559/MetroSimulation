package com.nammametro.simulation.metro.infrastructure.loader;

import tools.jackson.databind.ObjectMapper;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawLine;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawStation;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawTrack;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Reads the canonical dataset (see {@code data/README.md}) off the classpath. {@code data/metro} is
 * mapped to {@code metro-data} on the classpath by {@code backend/pom.xml} so this never duplicates
 * the JSON files into backend resources.
 */
@Component
public class MetroDataLoader {

    private final ObjectMapper objectMapper;

    public MetroDataLoader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public RawMetroData load() {
        return new RawMetroData(
                readList("metro-data/stations.json", RawStation[].class),
                readList("metro-data/lines.json", RawLine[].class),
                readList("metro-data/tracks.json", RawTrack[].class)
        );
    }

    private <T> List<T> readList(String classpathLocation, Class<T[]> arrayType) {
        try (InputStream stream = new ClassPathResource(classpathLocation).getInputStream()) {
            return List.of(objectMapper.readValue(stream, arrayType));
        } catch (IOException | RuntimeException e) {
            throw new IllegalStateException("Failed to load metro dataset file: " + classpathLocation, e);
        }
    }
}
