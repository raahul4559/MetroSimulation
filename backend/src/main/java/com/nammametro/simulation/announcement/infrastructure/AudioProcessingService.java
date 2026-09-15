package com.nammametro.simulation.announcement.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * Turns a raw TTS clip into something that sounds like it's coming out of a station PA speaker,
 * not a phone held up to your ear — shells out to {@code ffmpeg} (not a Java audio library) because
 * its {@code loudnorm}/{@code acompressor}/{@code equalizer} filters are exactly the "EQ, gentle
 * compression, loudness normalization" the spec asks for, already battle-tested rather than
 * reimplemented. {@code aecho} stands in for "very subtle room/PA coloration... controlled reverb"
 * — a short, quiet echo rather than a true convolution reverb, which would need a sourced impulse
 * response file this project doesn't have; deliberately kept quiet enough to stay short of the
 * spec's explicit "no excessive echo, distortion, robotic effects, or heavy reverb."
 *
 * <p>{@link #isAvailable()} is checked once and cached — if {@code ffmpeg} isn't on {@code PATH},
 * every subsequent {@link #process} call is skipped up front by
 * {@link com.nammametro.simulation.announcement.application.AnnouncementAudioService} rather than
 * repeatedly trying and failing to launch a process that will never exist for this process's
 * lifetime.
 */
@Component
public class AudioProcessingService {

    private static final Logger log = LoggerFactory.getLogger(AudioProcessingService.class);

    /** Loudness-normalize to broadcast-typical level, compress gently so quiet/loud phrases sit at
     * a similar level, nudge presence frequencies the way a PA speaker naturally emphasizes speech,
     * then a short/quiet echo for room character. Filter order matters: normalize and compress
     * before the echo, so the echo tail doesn't get re-amplified by loudnorm. */
    static final String FILTER_CHAIN =
            "loudnorm=I=-16:TP=-1.5:LRA=11,"
                    + "acompressor=threshold=-18dB:ratio=3:attack=5:release=50,"
                    + "equalizer=f=3000:width_type=o:width=2:g=2,"
                    + "aecho=0.6:0.4:35:0.12";

    private static final long PROCESS_TIMEOUT_SECONDS = 30;

    private final String ffmpegPath;
    private volatile Boolean available;

    public AudioProcessingService(@Value("${announcement.audio.ffmpeg-path:ffmpeg}") String ffmpegPath) {
        this.ffmpegPath = ffmpegPath;
    }

    public boolean isAvailable() {
        Boolean cached = available;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (available == null) {
                available = probe();
            }
            return available;
        }
    }

    /** Runs the filter chain over {@code rawWav} (LINEAR16/WAV, as produced by {@link TtsClient})
     * and returns processed MP3 bytes. Throws {@link AudioProcessingException} on any failure —
     * callers must treat that as "audio unavailable," never propagate it to an HTTP 500 (spec §11:
     * missing audio must never stop the simulation). */
    public byte[] process(byte[] rawWav) {
        Path input = null;
        Path output = null;
        try {
            input = Files.createTempFile("announcement-in-", ".wav");
            output = Files.createTempFile("announcement-out-", ".mp3");
            Files.write(input, rawWav);

            ProcessBuilder builder = new ProcessBuilder(
                    ffmpegPath, "-y", "-i", input.toString(),
                    "-af", FILTER_CHAIN,
                    "-codec:a", "libmp3lame", "-b:a", "128k",
                    output.toString());
            builder.redirectErrorStream(true);
            Process process = builder.start();
            String processLog = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

            boolean finished = process.waitFor(PROCESS_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new AudioProcessingException("ffmpeg timed out after " + PROCESS_TIMEOUT_SECONDS + "s");
            }
            if (process.exitValue() != 0) {
                throw new AudioProcessingException("ffmpeg exited with " + process.exitValue() + ": " + processLog);
            }
            return Files.readAllBytes(output);
        } catch (IOException e) {
            throw new AudioProcessingException("Audio processing I/O failure", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AudioProcessingException("Audio processing was interrupted", e);
        } finally {
            deleteQuietly(input);
            deleteQuietly(output);
        }
    }

    private boolean probe() {
        try {
            Process process = new ProcessBuilder(ffmpegPath, "-version").redirectErrorStream(true).start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return false;
            }
            return process.exitValue() == 0;
        } catch (IOException e) {
            log.warn("ffmpeg not available at '{}': {}", ffmpegPath, e.getMessage());
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.debug("Could not delete temp file {}: {}", path, e.getMessage());
        }
    }
}
