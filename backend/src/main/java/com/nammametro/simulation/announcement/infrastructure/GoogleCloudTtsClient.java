package com.nammametro.simulation.announcement.infrastructure;

import com.nammametro.simulation.announcement.domain.model.AnnouncementLanguage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;

/**
 * {@link TtsClient} backed by Google Cloud Text-to-Speech's REST {@code text:synthesize} endpoint
 * — chosen (over Azure/ElevenLabs) specifically for its en-IN/hi-IN/kn-IN voice coverage, per the
 * spec's requirement that Hindi and Kannada come from genuinely native voices, not an English voice
 * doing the pronunciation. Requests LINEAR16 (WAV) output rather than MP3 because
 * {@link AudioProcessingService}'s ffmpeg filter chain wants uncompressed PCM in, not a second
 * lossy re-encode of an already-lossy clip.
 *
 * <p>Voice names default to well-known en-IN/hi-IN/kn-IN voices as of this writing but are
 * deliberately overridable via {@code announcement.audio.voice-*} — Google's voice catalog changes
 * over time, so pin/verify the exact names against the Cloud Console's voice list rather than
 * trusting these defaults blindly. Kannada in particular has much thinner Neural2 coverage than
 * English/Hindi; the default below is the safest bet, not a guarantee of the *best* available voice.
 */
@Component
public class GoogleCloudTtsClient implements TtsClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleCloudTtsClient.class);
    private static final String ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
    /** A calm, moderate-paced PA delivery — slightly below 1x, matching the browser-TTS fallback's
     * own rate so switching providers doesn't change the perceived pacing. */
    private static final double SPEAKING_RATE = 0.93;
    private static final int SAMPLE_RATE_HERTZ = 24000;

    private final RestClient restClient;
    private final String apiKey;
    private final Map<AnnouncementLanguage, String> voiceNames;

    public GoogleCloudTtsClient(
            @Value("${announcement.audio.google-tts-api-key:}") String apiKey,
            @Value("${announcement.audio.voice-en:en-IN-Neural2-A}") String voiceEn,
            @Value("${announcement.audio.voice-hi:hi-IN-Neural2-A}") String voiceHi,
            @Value("${announcement.audio.voice-kn:kn-IN-Standard-A}") String voiceKn
    ) {
        // Built directly rather than injecting a `RestClient.Builder` bean — this project's Spring
        // Boot 4 starter set (`spring-boot-starter-webmvc`, not the full `spring-boot-starter-web`)
        // doesn't autoconfigure one, and this client needs nothing from it beyond the default config.
        this.restClient = RestClient.builder().build();
        this.apiKey = apiKey;
        this.voiceNames = new EnumMap<>(AnnouncementLanguage.class);
        this.voiceNames.put(AnnouncementLanguage.EN, voiceEn);
        this.voiceNames.put(AnnouncementLanguage.HI, voiceHi);
        this.voiceNames.put(AnnouncementLanguage.KN, voiceKn);
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public String voiceNameFor(AnnouncementLanguage language) {
        return voiceNames.get(language);
    }

    @Override
    public byte[] synthesizeLinear16(String text, AnnouncementLanguage language) {
        if (!isAvailable()) {
            throw new TtsSynthesisException("Google Cloud TTS API key not configured");
        }

        String ssml = SsmlBuilder.wrap(text);
        GoogleTtsRequest request = new GoogleTtsRequest(
                Map.of("ssml", ssml),
                Map.of("languageCode", language.bcp47(), "name", voiceNames.get(language)),
                Map.of("audioEncoding", "LINEAR16", "speakingRate", SPEAKING_RATE, "sampleRateHertz", SAMPLE_RATE_HERTZ)
        );

        try {
            GoogleTtsResponse response = restClient.post()
                    .uri(ENDPOINT + "?key={key}", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(GoogleTtsResponse.class);

            if (response == null || response.audioContent() == null || response.audioContent().isBlank()) {
                throw new TtsSynthesisException("Google Cloud TTS returned no audio content");
            }
            return Base64.getDecoder().decode(response.audioContent());
        } catch (RestClientException e) {
            log.warn("Google Cloud TTS request failed for language={}: {}", language, e.getMessage());
            throw new TtsSynthesisException("Google Cloud TTS request failed", e);
        }
    }

    private record GoogleTtsRequest(Map<String, Object> input, Map<String, Object> voice, Map<String, Object> audioConfig) {
    }

    private record GoogleTtsResponse(String audioContent) {
    }
}
