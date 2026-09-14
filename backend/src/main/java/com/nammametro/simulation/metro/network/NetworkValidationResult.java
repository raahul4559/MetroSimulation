package com.nammametro.simulation.metro.network;

import java.util.List;

public record NetworkValidationResult(List<ValidationIssue> issues) {

    public boolean hasErrors() {
        return issues.stream().anyMatch(issue -> issue.severity() == ValidationSeverity.ERROR);
    }

    public List<ValidationIssue> errors() {
        return issues.stream().filter(issue -> issue.severity() == ValidationSeverity.ERROR).toList();
    }

    public List<ValidationIssue> warnings() {
        return issues.stream().filter(issue -> issue.severity() == ValidationSeverity.WARNING).toList();
    }
}
