/**
 * The research layer behind a station's `ArchitecturalProfile` (see `domain/stationConfig.ts`):
 * what real public sources say about a station's architecture, kept entirely separate from the 3D
 * asset config so citation/licensing metadata never has to travel through render code. Lives on
 * disk at `public/stations/<slug>/references.json`, loaded only by the dev reference panel and by
 * nothing on the render path itself — a missing or malformed file degrades to "no references
 * available," never a render error.
 *
 * <p>This project does not download or store the actual photographs: `references.*` below are
 * pointers to publicly viewable pages, gathered by reading their text content (search results,
 * article bodies), not by inspecting or scraping individual images. Treat every string here as "a
 * page that discusses this aspect," not "a verified photograph of this aspect" — `referenceNotes`
 * says explicitly which parts of a reconstruction are actually supported by that text versus
 * architecturally reasonable estimation.
 */

export type ReferenceConfidence = "high" | "medium" | "low";

export interface StationVisualReferenceCategories {
  readonly exterior: readonly string[];
  readonly platform: readonly string[];
  readonly concourse: readonly string[];
  readonly entrance: readonly string[];
  readonly signage: readonly string[];
  readonly surroundings: readonly string[];
}

/** One real source consulted for a station, kept distinct from the bare `sourceUrls` list so
 * licensing/attribution (spec section 10) survives even when a URL alone wouldn't carry it —
 * required before any future step that *does* handle actual images, and useful today for the dev
 * reference panel's citation display. */
export interface StationReferenceSource {
  readonly url: string;
  readonly title: string;
  /** Publisher or site, e.g. "Wikipedia", "BMRCL" — not a personal creator credit, since none of
   * the sources used so far are individually-authored photographs. */
  readonly publisher: string;
  /** ISO date this source was actually consulted, so a stale reference is visible as such rather
   * than looking perpetually current. */
  readonly retrievedOn: string;
  /** Free-text licensing/reuse note — e.g. "Wikipedia article text, CC BY-SA 4.0" or "Public news
   * article, referenced for facts only, not reproduced." Never left implicit. */
  readonly usageNote: string;
}

export interface StationVisualReference {
  readonly stationId: string;
  readonly stationName: string;
  readonly line: readonly string[];
  readonly stationType: "elevated" | "underground" | "at_grade";
  readonly references: StationVisualReferenceCategories;
  readonly sourceUrls: readonly string[];
  readonly sources: readonly StationReferenceSource[];
  readonly referenceNotes: readonly string[];
  /** "high" only when multiple independent sources corroborate both structural facts (platform
   * count, depth, interchange arrangement) and some visual/material detail; "medium" when
   * structural facts are solid but visual/material detail is thin; "low" for a station that has
   * received no dedicated research pass yet — see `stationConfig.ts`'s `synthesized` flag, which
   * every "low" station should also have. */
  readonly referenceConfidence: ReferenceConfidence;
}
