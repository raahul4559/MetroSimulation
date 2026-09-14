package com.nammametro.simulation.trainsim.domain.model;

/** A signal's displayed aspect — one-to-one with the {@link BlockState} it protects: FREE → GREEN,
 * RESERVED → YELLOW, OCCUPIED → RED. Distinct type from {@code BlockState} because a signal is what
 * a train (or the map UI) actually observes; the block state is the ground truth behind it. */
public enum SignalAspect {
    RED,
    YELLOW,
    GREEN
}
