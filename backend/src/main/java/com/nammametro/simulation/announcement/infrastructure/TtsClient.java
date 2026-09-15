package com.nammametro.simulation.announcement.infrastructure;

import com.nammametro.simulation.announcement.domain.model.AnnouncementLanguage;

/**
 * Abstraction over "turn this text into raw speech audio" — kept separate from
 * {@link com.nammametro.simulation.announcement.application.AnnouncementAudioService} (which owns
 * caching/never-regenerate-twice) and from {@link AudioProcessingService} (which owns making it
 * sound like a PA system), so each concern can be tested and reasoned about independently.
 * {@link GoogleCloudTtsClient} is the only real implementation; tests use a fake.
 */
public interface TtsClient {

    /** Whether this client is configured to make real requests right now (e.g. an API key is
     * present) — checked before attempting synthesis so a missing credential fails fast and
     * predictably instead of as a network-layer error. */
    boolean isAvailable();

    /** The provider's voice identifier used for {@code language} — part of the cache key, so
     * changing the configured voice naturally invalidates previously-cached clips. */
    String voiceNameFor(AnnouncementLanguage language);

    /** Synthesizes {@code text} in {@code language} as LINEAR16-encoded WAV bytes (uncompressed,
     * the format {@link AudioProcessingService}'s ffmpeg filter chain expects as input). Throws
     * {@link TtsSynthesisException} on any failure — never returns a partial/corrupt result. */
    byte[] synthesizeLinear16(String text, AnnouncementLanguage language);
}
