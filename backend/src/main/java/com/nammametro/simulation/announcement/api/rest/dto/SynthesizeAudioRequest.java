package com.nammametro.simulation.announcement.api.rest.dto;

import jakarta.validation.constraints.NotBlank;

/** The exact text to speak, already fully resolved by the frontend's template/pronunciation
 * pipeline (see {@code frontend/src/lib/announcements/templates}) — this service synthesizes
 * sentences, it never builds them. {@code language} is the {@code AnnouncementLanguage} code
 * ({@code en}/{@code hi}/{@code kn}). */
public record SynthesizeAudioRequest(
        @NotBlank String text,
        @NotBlank String language
) {
}
