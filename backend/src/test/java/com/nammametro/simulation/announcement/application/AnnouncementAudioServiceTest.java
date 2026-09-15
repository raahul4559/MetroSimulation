package com.nammametro.simulation.announcement.application;

import com.nammametro.simulation.announcement.domain.model.AnnouncementLanguage;
import com.nammametro.simulation.announcement.domain.model.AudioAsset;
import com.nammametro.simulation.announcement.infrastructure.AudioProcessingException;
import com.nammametro.simulation.announcement.infrastructure.AudioProcessingService;
import com.nammametro.simulation.announcement.infrastructure.TtsClient;
import com.nammametro.simulation.announcement.infrastructure.TtsSynthesisException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Exercises {@link AnnouncementAudioService}'s cache-hit/miss/unavailable/failure paths against
 * fakes — never touches a real network or a real {@code ffmpeg} binary, so this passes in any CI
 * environment regardless of whether either is present, matching the "never a 500, never blocks the
 * caller" contract the class itself documents. */
class AnnouncementAudioServiceTest {

    private static final AnnouncementLanguage LANG = AnnouncementLanguage.EN;
    private static final byte[] RAW_WAV = "raw-wav".getBytes(StandardCharsets.UTF_8);
    private static final byte[] PROCESSED_MP3 = "processed-mp3".getBytes(StandardCharsets.UTF_8);

    @TempDir
    Path cacheDir;

    @Test
    void cacheMissSynthesizesProcessesAndPersistsToDisk() {
        FakeTtsClient tts = FakeTtsClient.available(RAW_WAV);
        FakeAudioProcessingService processor = FakeAudioProcessingService.available(PROCESSED_MP3);
        AnnouncementAudioService service = newService(tts, processor);

        Optional<AudioAsset> result = service.synthesize("Next station, Majestic.", LANG);

        assertThat(result).isPresent();
        AudioAsset asset = result.get();
        assertThat(asset.audioBytes()).isEqualTo(PROCESSED_MP3);
        assertThat(asset.language()).isEqualTo(LANG);
        assertThat(asset.source()).isEqualTo("Google Cloud TTS");
        assertThat(asset.license()).contains("not real Namma Metro/BMRCL audio");
        assertThat(tts.synthesizeCallCount).isEqualTo(1);

        List<AudioManifestEntry> manifest = service.listManifest();
        assertThat(manifest).hasSize(1);
        assertThat(manifest.get(0).text()).isEqualTo("Next station, Majestic.");
        assertThat(manifest.get(0).cacheKey()).isEqualTo(asset.cacheKey());
    }

    @Test
    void cacheHitOnSecondCallNeverTouchesTtsClientAgain() {
        FakeTtsClient tts = FakeTtsClient.available(RAW_WAV);
        FakeAudioProcessingService processor = FakeAudioProcessingService.available(PROCESSED_MP3);
        AnnouncementAudioService service = newService(tts, processor);

        Optional<AudioAsset> first = service.synthesize("Doors closing.", LANG);
        Optional<AudioAsset> second = service.synthesize("Doors closing.", LANG);

        assertThat(first).isPresent();
        assertThat(second).isPresent();
        assertThat(second.get().audioBytes()).isEqualTo(first.get().audioBytes());
        assertThat(tts.synthesizeCallCount).isEqualTo(1); // the whole point of the cache
        assertThat(processor.processCallCount).isEqualTo(1);
    }

    @Test
    void ttsClientUnavailableReturnsEmptyWithoutAttemptingSynthesis() {
        FakeTtsClient tts = FakeTtsClient.unavailable();
        FakeAudioProcessingService processor = FakeAudioProcessingService.available(PROCESSED_MP3);
        AnnouncementAudioService service = newService(tts, processor);

        Optional<AudioAsset> result = service.synthesize("Please mind the gap.", LANG);

        assertThat(result).isEmpty();
        assertThat(tts.synthesizeCallCount).isZero();
        assertThat(service.listManifest()).isEmpty();
    }

    @Test
    void audioProcessingUnavailableReturnsEmptyWithoutAttemptingSynthesis() {
        FakeTtsClient tts = FakeTtsClient.available(RAW_WAV);
        FakeAudioProcessingService processor = FakeAudioProcessingService.unavailable();
        AnnouncementAudioService service = newService(tts, processor);

        Optional<AudioAsset> result = service.synthesize("Please mind the gap.", LANG);

        assertThat(result).isEmpty();
        assertThat(tts.synthesizeCallCount).isZero();
    }

    @Test
    void ttsSynthesisFailureIsCaughtAndReportedAsEmpty() {
        FakeTtsClient tts = FakeTtsClient.failing(new TtsSynthesisException("boom"));
        FakeAudioProcessingService processor = FakeAudioProcessingService.available(PROCESSED_MP3);
        AnnouncementAudioService service = newService(tts, processor);

        Optional<AudioAsset> result = service.synthesize("Service disruption.", LANG);

        assertThat(result).isEmpty();
        assertThat(service.listManifest()).isEmpty();
    }

    @Test
    void audioProcessingFailureIsCaughtAndReportedAsEmpty() {
        FakeTtsClient tts = FakeTtsClient.available(RAW_WAV);
        FakeAudioProcessingService processor = FakeAudioProcessingService.failing(new AudioProcessingException("ffmpeg exploded"));
        AnnouncementAudioService service = newService(tts, processor);

        Optional<AudioAsset> result = service.synthesize("Service disruption.", LANG);

        assertThat(result).isEmpty();
        assertThat(service.listManifest()).isEmpty();
    }

    @Test
    void blankTextIsRejectedWithoutTouchingAnyDependency() {
        FakeTtsClient tts = FakeTtsClient.available(RAW_WAV);
        FakeAudioProcessingService processor = FakeAudioProcessingService.available(PROCESSED_MP3);
        AnnouncementAudioService service = newService(tts, processor);

        assertThat(service.synthesize("   ", LANG)).isEmpty();
        assertThat(service.synthesize(null, LANG)).isEmpty();
        assertThat(tts.synthesizeCallCount).isZero();
        assertThat(processor.processCallCount).isZero();
    }

    @Test
    void listManifestOnAFreshCacheDirIsEmpty() throws Exception {
        Path freshDir = Files.createTempDirectory("announcement-audio-empty-");
        AnnouncementAudioService service = new AnnouncementAudioService(
                FakeTtsClient.available(RAW_WAV),
                FakeAudioProcessingService.available(PROCESSED_MP3),
                freshDir.resolve("nested/not-yet-created").toString(),
                JsonMapper.builder().build());

        assertThat(service.listManifest()).isEmpty();
    }

    private AnnouncementAudioService newService(TtsClient tts, AudioProcessingService processor) {
        return new AnnouncementAudioService(tts, processor, cacheDir.toString(), JsonMapper.builder().build());
    }

    /** Minimal {@link TtsClient} fake — real behavior (availability, call counting, canned
     * response or exception) without a network call. */
    private static final class FakeTtsClient implements TtsClient {
        private final boolean available;
        private final byte[] response;
        private final RuntimeException failure;
        int synthesizeCallCount;

        private FakeTtsClient(boolean available, byte[] response, RuntimeException failure) {
            this.available = available;
            this.response = response;
            this.failure = failure;
        }

        static FakeTtsClient available(byte[] response) {
            return new FakeTtsClient(true, response, null);
        }

        static FakeTtsClient unavailable() {
            return new FakeTtsClient(false, null, null);
        }

        static FakeTtsClient failing(RuntimeException failure) {
            return new FakeTtsClient(true, null, failure);
        }

        @Override
        public boolean isAvailable() {
            return available;
        }

        @Override
        public String voiceNameFor(AnnouncementLanguage language) {
            return "fake-voice-" + language.code();
        }

        @Override
        public byte[] synthesizeLinear16(String text, AnnouncementLanguage language) {
            synthesizeCallCount++;
            if (failure != null) {
                throw failure;
            }
            return response;
        }
    }

    /** Minimal {@link AudioProcessingService} fake — subclasses the real (non-final) class and
     * overrides its two public methods, so tests never shell out to a real {@code ffmpeg}. */
    private static final class FakeAudioProcessingService extends AudioProcessingService {
        private final boolean available;
        private final byte[] response;
        private final RuntimeException failure;
        int processCallCount;

        private FakeAudioProcessingService(boolean available, byte[] response, RuntimeException failure) {
            super("unused");
            this.available = available;
            this.response = response;
            this.failure = failure;
        }

        static FakeAudioProcessingService available(byte[] response) {
            return new FakeAudioProcessingService(true, response, null);
        }

        static FakeAudioProcessingService unavailable() {
            return new FakeAudioProcessingService(false, null, null);
        }

        static FakeAudioProcessingService failing(RuntimeException failure) {
            return new FakeAudioProcessingService(true, null, failure);
        }

        @Override
        public boolean isAvailable() {
            return available;
        }

        @Override
        public byte[] process(byte[] rawWav) {
            processCallCount++;
            if (failure != null) {
                throw failure;
            }
            return response;
        }
    }
}
