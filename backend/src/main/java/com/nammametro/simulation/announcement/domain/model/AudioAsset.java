package com.nammametro.simulation.announcement.domain.model;

import java.time.Instant;

/**
 * One synthesized-and-processed announcement clip, whether just generated or read back from the
 * disk cache — the two paths return the exact same shape so callers never need to know which one
 * happened. {@code source}/{@code license}/{@code generatedAt} exist so every externally-sourced
 * audio asset in this system carries its own attribution, per the "never present unofficial audio
 * as official Namma Metro audio" requirement — there is no legally reusable real BMRCL recording
 * behind any clip this produces, and that must stay visible, not just true.
 */
public record AudioAsset(
        byte[] audioBytes,
        String cacheKey,
        AnnouncementLanguage language,
        String text,
        String voiceName,
        String source,
        String license,
        Instant generatedAt
) {
}
