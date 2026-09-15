package com.nammametro.simulation.announcement.application;

import com.nammametro.simulation.announcement.domain.model.AudioAsset;

import java.time.Instant;

/**
 * The persisted (and API-exposed) shape of one cached clip's provenance — everything about
 * {@link AudioAsset} except the audio bytes themselves. Serialized as the JSON sidecar next to
 * each {@code .mp3} in the disk cache, and returned as-is by
 * {@code GET /api/announcements/audio/manifest} — the spec's "store source/license/attribution
 * information for every externally sourced audio asset" requirement, queryable rather than just
 * true.
 */
public record AudioManifestEntry(
        String cacheKey,
        String language,
        String text,
        String voiceName,
        String source,
        String license,
        Instant generatedAt
) {

    static AudioManifestEntry from(AudioAsset asset) {
        return new AudioManifestEntry(
                asset.cacheKey(),
                asset.language().code(),
                asset.text(),
                asset.voiceName(),
                asset.source(),
                asset.license(),
                asset.generatedAt());
    }
}
