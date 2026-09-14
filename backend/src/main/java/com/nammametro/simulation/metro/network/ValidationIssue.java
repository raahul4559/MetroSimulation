package com.nammametro.simulation.metro.network;

public record ValidationIssue(ValidationSeverity severity, String code, String message) {

    static ValidationIssue error(String code, String message) {
        return new ValidationIssue(ValidationSeverity.ERROR, code, message);
    }

    static ValidationIssue warning(String code, String message) {
        return new ValidationIssue(ValidationSeverity.WARNING, code, message);
    }

    @Override
    public String toString() {
        return "[%s] %s: %s".formatted(severity, code, message);
    }
}
