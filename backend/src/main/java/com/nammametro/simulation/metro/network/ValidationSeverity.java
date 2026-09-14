package com.nammametro.simulation.metro.network;

public enum ValidationSeverity {
    /** Makes the graph unreliable to route on — fails startup. */
    ERROR,
    /** Worth knowing about, but the graph is still usable. */
    WARNING
}
