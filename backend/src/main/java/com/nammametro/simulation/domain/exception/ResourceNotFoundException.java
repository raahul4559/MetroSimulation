package com.nammametro.simulation.domain.exception;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String resourceType, String identifier) {
        super("%s not found: %s".formatted(resourceType, identifier));
    }
}
