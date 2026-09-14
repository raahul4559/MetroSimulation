package com.nammametro.simulation.trainsim.domain;

import com.nammametro.simulation.trainsim.domain.model.SimulationState;
import com.nammametro.simulation.trainsim.domain.model.TrainState;
import com.nammametro.simulation.trainsim.domain.model.TrainStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Detects impossible states in a {@link SimulationState} — states {@code TrainMovementTickHandler}
 * should never produce, checked independently of it so a bug in that handler's own bookkeeping
 * can't hide from itself. Pure and read-only: reports issues as strings, changes nothing.
 *
 * <p>The one check that matters for collision safety: no two trains may report the same
 * {@code currentTrackId} while both are physically in that block ({@code DEPARTING}/{@code RUNNING}/
 * {@code ARRIVING} — {@code RESERVED} is a one-tick commitment, not physical presence, so a
 * departing train sharing an id-space with itself the instant it's granted the block isn't a
 * collision). This is "two trains cannot occupy the same protected section simultaneously," pinned
 * down as code that can actually fail a test, not just a claim in a comment.
 */
public final class BlockSafetyValidator {

    private BlockSafetyValidator() {
    }

    private static final java.util.Set<TrainStatus> IN_BLOCK = java.util.Set.of(
            TrainStatus.DEPARTING, TrainStatus.RUNNING, TrainStatus.ARRIVING);

    public static List<String> validate(SimulationState state) {
        List<String> issues = new ArrayList<>();

        Map<Long, List<TrainState>> byTrack = state.trains().stream()
                .filter(t -> t.currentTrackId() != null && IN_BLOCK.contains(t.status()))
                .collect(Collectors.groupingBy(TrainState::currentTrackId));

        byTrack.forEach((trackId, trains) -> {
            if (trains.size() > 1) {
                String codes = trains.stream().map(TrainState::code).collect(Collectors.joining(", "));
                issues.add("Block %d has %d trains simultaneously (%s) — a protected section must have at most one"
                        .formatted(trackId, trains.size(), codes));
            }
        });

        for (TrainState train : state.trains()) {
            if (train.progress() < 0.0 || train.progress() > 1.0) {
                issues.add("%s has out-of-range progress %.4f on track %s"
                        .formatted(train.code(), train.progress(), train.currentTrackId()));
            }
        }

        return issues;
    }
}
