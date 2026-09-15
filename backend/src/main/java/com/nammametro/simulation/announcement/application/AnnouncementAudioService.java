package com.nammametro.simulation.announcement.application;

import com.nammametro.simulation.announcement.domain.model.AnnouncementLanguage;
import com.nammametro.simulation.announcement.domain.model.AudioAsset;
import com.nammametro.simulation.announcement.infrastructure.AudioProcessingService;
import com.nammametro.simulation.announcement.infrastructure.TtsClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * The orchestrator behind {@code POST /api/announcements/audio}: "never generate a new AI voice
 * recording every time a train arrives," made real. A clip is identified purely by
 * {@code sha256(text|language|voice|processingChainVersion)} — the same station-arrival sentence
 * always resolves to the same file, so the disk cache under {@code announcement.audio.cache-dir}
 * IS the reusable audio library the spec asks for (populated ahead of time by the frontend's
 * preload script, or lazily on first real use — either way, once).
 *
 * <p>{@link #synthesize} never throws: a cache hit returns immediately without touching the
 * network; a miss calls {@link TtsClient} then {@link AudioProcessingService}, but any failure
 * anywhere in that chain (no credentials, network error, missing ffmpeg) is caught here and
 * reported as {@link Optional#empty()} — never an exception a controller would have to turn into a
 * 500. Callers (see {@code AnnouncementAudioController}) turn an empty result into
 * {@code 204 No Content}, and the frontend's {@code VoiceProvider} chain treats that as "fall back
 * to the next tier," per spec §11.
 */
@Service
public class AnnouncementAudioService {

    private static final Logger log = LoggerFactory.getLogger(AnnouncementAudioService.class);

    /** Bumping this invalidates every previously-cached clip by changing every future cache key —
     * the escape hatch for "we tuned the ffmpeg chain / picked a different voice, regenerate
     * everything" without having to manually clear the cache directory. */
    static final String PROCESSING_CHAIN_VERSION = "v1";
    private static final String SOURCE = "Google Cloud TTS";
    private static final String LICENSE_NOTE =
            "Synthetic voice generated via Google Cloud Text-to-Speech — not real Namma Metro/BMRCL audio.";

    private final TtsClient ttsClient;
    private final AudioProcessingService audioProcessingService;
    private final Path cacheDir;
    private final ObjectMapper objectMapper;

    public AnnouncementAudioService(
            TtsClient ttsClient,
            AudioProcessingService audioProcessingService,
            @Value("${announcement.audio.cache-dir:./data/audio-cache}") String cacheDir,
            ObjectMapper objectMapper
    ) {
        this.ttsClient = ttsClient;
        this.audioProcessingService = audioProcessingService;
        this.cacheDir = Path.of(cacheDir);
        this.objectMapper = objectMapper;
    }

    public Optional<AudioAsset> synthesize(String text, AnnouncementLanguage language) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }

        String voiceName = ttsClient.voiceNameFor(language);
        String cacheKey = computeCacheKey(text, language, voiceName);
        Path audioPath = assetPath(language, cacheKey, "mp3");
        Path manifestPath = assetPath(language, cacheKey, "json");

        Optional<AudioAsset> cached = readFromCache(audioPath, manifestPath);
        if (cached.isPresent()) {
            return cached;
        }

        if (!ttsClient.isAvailable() || !audioProcessingService.isAvailable()) {
            return Optional.empty();
        }

        try {
            byte[] rawWav = ttsClient.synthesizeLinear16(text, language);
            byte[] processed = audioProcessingService.process(rawWav);
            AudioAsset asset = new AudioAsset(
                    processed, cacheKey, language, text, voiceName, SOURCE, LICENSE_NOTE, Instant.now());
            writeToCache(audioPath, manifestPath, asset);
            return Optional.of(asset);
        } catch (RuntimeException e) {
            log.warn("Announcement audio synthesis failed (language={}, cacheKey={}): {}",
                    language, cacheKey, e.getMessage());
            return Optional.empty();
        }
    }

    /** Every asset currently on disk, newest first — the spec's "store source/license/attribution
     * for every externally sourced audio asset," made queryable via
     * {@code GET /api/announcements/audio/manifest} rather than only true in code comments. */
    public List<AudioManifestEntry> listManifest() {
        if (!Files.isDirectory(cacheDir)) {
            return List.of();
        }
        List<AudioManifestEntry> entries = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(cacheDir)) {
            paths.filter(p -> p.toString().endsWith(".json")).forEach(p -> {
                try {
                    entries.add(objectMapper.readValue(p.toFile(), AudioManifestEntry.class));
                } catch (JacksonException e) {
                    log.warn("Skipping unreadable manifest entry {}: {}", p, e.getMessage());
                }
            });
        } catch (IOException e) {
            log.warn("Failed to list announcement audio cache directory {}: {}", cacheDir, e.getMessage());
            return List.of();
        }
        entries.sort(Comparator.comparing(AudioManifestEntry::generatedAt).reversed());
        return entries;
    }

    private String computeCacheKey(String text, AnnouncementLanguage language, String voiceName) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String raw = text + "|" + language.code() + "|" + voiceName + "|" + PROCESSING_CHAIN_VERSION;
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private Path assetPath(AnnouncementLanguage language, String cacheKey, String extension) {
        return cacheDir.resolve(language.code()).resolve(cacheKey + "." + extension);
    }

    private Optional<AudioAsset> readFromCache(Path audioPath, Path manifestPath) {
        if (!Files.exists(audioPath) || !Files.exists(manifestPath)) {
            return Optional.empty();
        }
        try {
            byte[] bytes = Files.readAllBytes(audioPath);
            AudioManifestEntry entry = objectMapper.readValue(manifestPath.toFile(), AudioManifestEntry.class);
            return Optional.of(new AudioAsset(
                    bytes,
                    entry.cacheKey(),
                    AnnouncementLanguage.fromCode(entry.language()),
                    entry.text(),
                    entry.voiceName(),
                    entry.source(),
                    entry.license(),
                    entry.generatedAt()));
        } catch (IOException | JacksonException e) {
            log.warn("Failed to read cached announcement audio at {}: {}", audioPath, e.getMessage());
            return Optional.empty();
        }
    }

    private void writeToCache(Path audioPath, Path manifestPath, AudioAsset asset) {
        try {
            Files.createDirectories(audioPath.getParent());
            Files.write(audioPath, asset.audioBytes());
            objectMapper.writerWithDefaultPrettyPrinter()
                    .writeValue(manifestPath.toFile(), AudioManifestEntry.from(asset));
        } catch (IOException | JacksonException e) {
            // Non-fatal: the caller already has the synthesized asset for this request; only the
            // *reuse* of it next time is lost, not this announcement.
            log.warn("Failed to write announcement audio cache entry {}: {}", audioPath, e.getMessage());
        }
    }
}
