package com.nammametro.simulation.announcement.infrastructure;

/** A {@link TtsClient} could not synthesize audio — missing credentials, a network failure, or a
 * malformed provider response. Always caught by
 * {@link com.nammametro.simulation.announcement.application.AnnouncementAudioService}, never
 * allowed to propagate to a controller as a 500 (see its class doc). */
public class TtsSynthesisException extends RuntimeException {

    public TtsSynthesisException(String message) {
        super(message);
    }

    public TtsSynthesisException(String message, Throwable cause) {
        super(message, cause);
    }
}
