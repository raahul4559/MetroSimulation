package com.nammametro.simulation.announcement.infrastructure;

/** {@link AudioProcessingService} could not run its ffmpeg filter chain over a raw TTS clip —
 * ffmpeg missing/not on {@code PATH}, a bad exit code, or the process timing out. Always caught by
 * {@link com.nammametro.simulation.announcement.application.AnnouncementAudioService}. */
public class AudioProcessingException extends RuntimeException {

    public AudioProcessingException(String message) {
        super(message);
    }

    public AudioProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
