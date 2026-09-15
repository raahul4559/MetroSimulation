package com.nammametro.simulation.announcement.domain.model;

/**
 * The three languages the station PA can speak — matches the frontend's {@code LanguageCode}
 * ({@code frontend/src/domain/announcement.ts}) exactly, code-for-code, since the frontend sends
 * this code verbatim in every synthesis request.
 */
public enum AnnouncementLanguage {
    EN("en", "en-IN"),
    HI("hi", "hi-IN"),
    KN("kn", "kn-IN");

    private final String code;
    private final String bcp47;

    AnnouncementLanguage(String code, String bcp47) {
        this.code = code;
        this.bcp47 = bcp47;
    }

    public String code() {
        return code;
    }

    /** The BCP-47 language tag Google Cloud TTS expects as {@code voice.languageCode}. */
    public String bcp47() {
        return bcp47;
    }

    public static AnnouncementLanguage fromCode(String code) {
        for (AnnouncementLanguage language : values()) {
            if (language.code.equals(code)) {
                return language;
            }
        }
        throw new IllegalArgumentException("Unknown announcement language: " + code);
    }
}
