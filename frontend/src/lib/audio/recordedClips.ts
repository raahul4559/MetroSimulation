import type { LanguageCode, RecordedClipProvenance } from "@/domain/announcement";

/**
 * Real recorded announcement clips — the preferred voice tier, ahead of any TTS. Read once from
 * `public/audio/announcements/manifest.json`, which ships empty: no legally reusable Namma
 * Metro/BMRCL recording is known, and a clip is never added just because it can be downloaded.
 *
 * A clip is used only when its manifest entry clears {@link validateClipEntry}: a license on
 * {@link ALLOWED_LICENSES}, a named attribution, a source URL, and a file under
 * `/audio/announcements/`. An entry may only claim `official: true` if it also names the document
 * granting BMRCL's permission (`officialPermission`); anything else is rejected outright rather
 * than quietly downgraded, so a mislabelled clip can't slip through.
 *
 * Matching is by whole sentence (see {@link normalizePhrase}), so recordings only ever replace
 * fixed phrases ("Please stand clear of the doors.") — never a sentence a template built around a
 * different station or destination.
 */
export interface RecordedClipEntry {
  readonly id: string;
  readonly language: LanguageCode;
  /** The exact sentence the recording says, as the templates would render it. */
  readonly text: string;
  /** Path under `public/`, e.g. `/audio/announcements/en/stand-clear.ogg`. */
  readonly file: string;
  readonly attribution: string;
  /** SPDX-style id, e.g. `CC-BY-4.0`. */
  readonly license: string;
  readonly licenseUrl?: string | null;
  /** Where the recording was obtained. Required unless `license` is `OWN-RECORDING`. */
  readonly sourceUrl?: string | null;
  readonly official: boolean;
  /** Required when `official` is true: the permission letter/URL from BMRCL. */
  readonly officialPermission?: string | null;
  readonly notes?: string | null;
}

/** Licenses that permit redistribution in this repo with attribution. `OWN-RECORDING` is audio
 * the project recorded itself (a volunteer reading the phrase), never a capture of the real PA. */
export const ALLOWED_LICENSES: ReadonlySet<string> = new Set([
  "CC0-1.0",
  "PDM-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "OWN-RECORDING",
]);

const LANGUAGES: ReadonlySet<string> = new Set(["en", "hi", "kn"]);
const CLIP_PATH_PREFIX = "/audio/announcements/";
const MANIFEST_URL = `${CLIP_PATH_PREFIX}manifest.json`;

/** Every reason `entry` can't be used; empty means it's usable. */
export function validateClipEntry(entry: Partial<RecordedClipEntry>): string[] {
  const problems: string[] = [];
  if (!entry.id) problems.push("missing id");
  if (!entry.language || !LANGUAGES.has(entry.language)) problems.push("language must be en, hi or kn");
  if (!entry.text?.trim()) problems.push("missing text");
  if (!entry.file?.startsWith(CLIP_PATH_PREFIX) || entry.file.includes("..")) {
    problems.push(`file must live under ${CLIP_PATH_PREFIX}`);
  }
  if (!entry.attribution?.trim()) problems.push("missing attribution");
  if (!entry.license || !ALLOWED_LICENSES.has(entry.license)) {
    problems.push(`license "${entry.license ?? ""}" is not on the allowed list`);
  }
  if (entry.license !== "OWN-RECORDING" && !entry.sourceUrl?.trim()) problems.push("missing sourceUrl");
  if (typeof entry.official !== "boolean") problems.push("official must be true or false");
  if (entry.official === true && !entry.officialPermission?.trim()) {
    problems.push("official: true requires officialPermission (BMRCL's grant)");
  }
  return problems;
}

/** Case, whitespace and trailing punctuation don't change which recording a sentence is. */
export function normalizePhrase(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s.,!?।]+$/u, "")
    .trim();
}

export interface RecordedClip {
  readonly url: string;
  readonly provenance: RecordedClipProvenance;
}

export type RecordedClipIndex = ReadonlyMap<string, RecordedClip>;

function indexKey(language: LanguageCode, text: string): string {
  return `${language}|${normalizePhrase(text)}`;
}

/** Builds the lookup from raw manifest JSON, dropping (and reporting) every invalid entry. */
export function buildClipIndex(raw: unknown): { index: RecordedClipIndex; rejected: { id: string; problems: string[] }[] } {
  const index = new Map<string, RecordedClip>();
  const rejected: { id: string; problems: string[] }[] = [];
  const entries = (raw as { clips?: unknown } | null)?.clips;
  if (!Array.isArray(entries)) return { index, rejected };

  for (const candidate of entries as Partial<RecordedClipEntry>[]) {
    const problems = validateClipEntry(candidate);
    if (problems.length > 0) {
      rejected.push({ id: candidate.id ?? "(no id)", problems });
      continue;
    }
    const entry = candidate as RecordedClipEntry;
    index.set(indexKey(entry.language, entry.text), {
      url: entry.file,
      provenance: {
        attribution: entry.attribution,
        license: entry.license,
        sourceUrl: entry.sourceUrl ?? null,
        official: entry.official,
      },
    });
  }
  return { index, rejected };
}

export function findClip(index: RecordedClipIndex, text: string, language: LanguageCode): RecordedClip | null {
  return index.get(indexKey(language, text)) ?? null;
}

let indexPromise: Promise<RecordedClipIndex> | null = null;

/** The manifest, fetched once per page load. A missing or broken manifest just means "no
 * recordings" — it never blocks an announcement. */
export function loadRecordedClips(): Promise<RecordedClipIndex> {
  if (!indexPromise) {
    indexPromise = fetch(MANIFEST_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((raw: unknown) => {
        const { index, rejected } = buildClipIndex(raw);
        for (const r of rejected) {
          console.warn(`[announcements] Ignoring recorded clip ${r.id}: ${r.problems.join("; ")}`);
        }
        return index as RecordedClipIndex;
      })
      .catch(() => new Map<string, RecordedClip>());
  }
  return indexPromise;
}
