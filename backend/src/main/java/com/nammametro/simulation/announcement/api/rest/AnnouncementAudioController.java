package com.nammametro.simulation.announcement.api.rest;

import com.nammametro.simulation.announcement.api.rest.dto.SynthesizeAudioRequest;
import com.nammametro.simulation.announcement.application.AnnouncementAudioService;
import com.nammametro.simulation.announcement.application.AudioManifestEntry;
import com.nammametro.simulation.announcement.domain.model.AnnouncementLanguage;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * The one HTTP surface the frontend's {@code CachedAudioVoiceProvider} talks to. Deliberately
 * dumb: no template logic, no station/pronunciation knowledge — the frontend sends already-resolved
 * text (see {@code SynthesizeAudioRequest}) and gets back either a playable clip or a clear signal
 * to fall back. {@code 204} (not an error status) is the "unavailable" signal, matching the spec's
 * §11 failure-handling: missing audio is an expected, normal outcome here, not a fault.
 */
@RestController
@RequestMapping("/api/announcements")
public class AnnouncementAudioController {

    private final AnnouncementAudioService announcementAudioService;

    public AnnouncementAudioController(AnnouncementAudioService announcementAudioService) {
        this.announcementAudioService = announcementAudioService;
    }

    /** Content-addressed by {@code text+language+voice}, so the response is safe to cache
     * immutably forever on the client — the same request will only ever resolve to the same
     * bytes (or a newer processing-chain version, which changes the underlying cache key anyway). */
    @PostMapping("/audio")
    public ResponseEntity<byte[]> synthesize(@Valid @RequestBody SynthesizeAudioRequest request) {
        AnnouncementLanguage language = AnnouncementLanguage.fromCode(request.language());
        return announcementAudioService.synthesize(request.text(), language)
                .map(asset -> ResponseEntity.ok()
                        .contentType(MediaType.valueOf("audio/mpeg"))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                        .body(asset.audioBytes()))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/audio/manifest")
    public List<AudioManifestEntry> manifest() {
        return announcementAudioService.listManifest();
    }
}
