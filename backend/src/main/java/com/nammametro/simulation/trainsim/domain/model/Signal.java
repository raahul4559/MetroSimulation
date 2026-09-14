package com.nammametro.simulation.trainsim.domain.model;

/**
 * A block signal — one per track (one block per track, the simplified division this simulation
 * uses; see {@code docs/architecture.md}'s "Signaling and block sections"). Computed fresh every
 * tick from which train (if any) currently controls that block, never persisted or mutated in
 * place, exactly like {@link TrainState}.
 *
 * <p>{@code trackId} is where the signal stands (guarding entry to the block starting there);
 * {@code protectedSectionId} is the block it protects. The two are always equal in this
 * one-signal-per-block model — kept as separate fields to mirror the spec's literal shape rather
 * than assuming they must coincide in a future, less-simplified model.
 */
public record Signal(
        String id,
        long trackId,
        long protectedSectionId,
        BlockState blockState,
        SignalAspect aspect,
        Long controllingTrainId
) {

    public static Signal free(long trackId) {
        return new Signal(idFor(trackId), trackId, trackId, BlockState.FREE, SignalAspect.GREEN, null);
    }

    public static Signal reserved(long trackId, long controllingTrainId) {
        return new Signal(idFor(trackId), trackId, trackId, BlockState.RESERVED, SignalAspect.YELLOW, controllingTrainId);
    }

    public static Signal occupied(long trackId, long controllingTrainId) {
        return new Signal(idFor(trackId), trackId, trackId, BlockState.OCCUPIED, SignalAspect.RED, controllingTrainId);
    }

    private static String idFor(long trackId) {
        return "SIG-" + trackId;
    }
}
