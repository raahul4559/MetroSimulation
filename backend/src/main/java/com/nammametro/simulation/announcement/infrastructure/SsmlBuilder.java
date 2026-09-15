package com.nammametro.simulation.announcement.infrastructure;

import java.util.regex.Pattern;

/**
 * Wraps plain announcement text in minimal SSML for a calm, natural PA delivery — a short
 * {@code <break>} between sentences (the "natural pauses" the spec asks for, distinct from a
 * generic TTS engine reading straight through punctuation) and nothing fancier: no pitch/rate
 * tricks per sentence, which is what makes a TTS voice sound like it's "performing" rather than
 * announcing. Sentence boundaries are detected on {@code . ! ? } and the Hindi/Devanagari danda
 * ({@code ।}), covering all three configured languages with one splitter.
 */
final class SsmlBuilder {

    private static final Pattern SENTENCE_BOUNDARY = Pattern.compile("(?<=[.!?।])\\s+");
    private static final String INTER_SENTENCE_BREAK = "<break time=\"280ms\"/>";

    private SsmlBuilder() {
    }

    static String wrap(String text) {
        String[] sentences = SENTENCE_BOUNDARY.split(text.strip());
        StringBuilder ssml = new StringBuilder("<speak>");
        for (int i = 0; i < sentences.length; i++) {
            if (sentences[i].isBlank()) {
                continue;
            }
            ssml.append(escape(sentences[i]));
            if (i < sentences.length - 1) {
                ssml.append(' ').append(INTER_SENTENCE_BREAK).append(' ');
            }
        }
        ssml.append("</speak>");
        return ssml.toString();
    }

    private static String escape(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
