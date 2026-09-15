/**
 * The station-asset layer: what a station physically *is* (construction type, interchange-ness,
 * where its 3D assets live) as opposed to `Station`'s topological role in the network graph. This
 * is deliberately a separate, additive dataset joined by `stationCode` — nothing here is read by
 * the simulation engine, and adding/editing an entry can never change train/passenger behaviour.
 */

/** How a station is physically built. Orthogonal to interchange-ness: an interchange can be
 * elevated, underground, or (in other metro systems, if ever added here) at-grade — see
 * `isInterchange` on {@link StationConfig} rather than a fourth enum value here. */
export type StationBuildType = "ELEVATED" | "UNDERGROUND" | "AT_GRADE";

/** The three-tier fidelity system from the spec, but resolved at *runtime* (see
 * `useStationAsset`), never authored: `HIGH` only when a real `.glb` actually answers at
 * `modelPath`, `RECONSTRUCTED` when a curated {@link StationConfig} entry exists to parameterize a
 * richer procedural build even without a real mesh, `PROCEDURAL` when neither is true (a station
 * the config dataset has never seen still renders, just generically). */
export type StationModelQuality = "HIGH" | "RECONSTRUCTED" | "PROCEDURAL";

/** Island platforms serve both directions from one shared deck (what this project's procedural
 * renderer builds today); side platforms would need two separate decks either side of a shared
 * track pair — reserved for a future station whose real layout actually needs it. */
export type PlatformArrangement = "ISLAND" | "SIDE";

/** What kind of real landmark a station's immediate surroundings should read as, driving which
 * context shape `ElevatedEnvironment`/`AtGradeEnvironment` add alongside the generic street
 * buildings — e.g. a park edge instead of a building on one side. `"NONE"` (the default when
 * unset) renders no landmark shape at all rather than guessing one. */
export type LandmarkType = "PARK" | "TRANSIT_HUB" | "INSTITUTION" | "NONE";

export interface StationLandmark {
  readonly type: LandmarkType;
  /** Short human label surfaced in the reference/dev panel, e.g. "Cubbon Park frontage" — never
   * rendered as in-scene text, since it names a real place the geometry only approximates. */
  readonly label: string;
}

/** Architecture facts distinct enough, per real references, to change this station's geometry
 * beyond what `buildType`/`isInterchange`/`platformArrangement` already capture — every field
 * optional because an uncurated (synthesized) station has none of these, and the renderer must
 * fall back to the generic shell rather than require them. Each populated field here should trace
 * back to a note in this station's `references.json` (see `StationVisualReference`) — this is
 * where that research actually turns into geometry, not just documentation. */
export interface ArchitecturalProfile {
  /** Street-level stair/entrance structures to render (elevated/at-grade only). */
  readonly entranceCount?: number;
  /** Platform depth below street level, for an underground station — only known for a handful of
   * stations; deepens/widens the tunnel shell when present rather than affecting scale for every
   * station uniformly. */
  readonly depthMeters?: number;
  /** Whether this underground station has a documented concourse level above the platform (true
   * multi-level interchanges like Majestic) — renders a mezzanine slab with a lit opening rather
   * than modelling the second level's own geometry, which the shared layout engine doesn't yet
   * support (see `references.json`'s notes for that disclosed limitation). */
  readonly hasMezzanine?: boolean;
  readonly landmark?: StationLandmark;
  /** A dominant real-world material/signage tone from the references, used to tint fascia/light
   * strips instead of the generic per-build-type default. */
  readonly accentColorHex?: string;
}

export interface StationConfig {
  /** URL/asset-folder slug, e.g. "majestic" — derived from `stationCode` when not curated. */
  readonly id: string;
  /** Join key back to `Station.code`. */
  readonly stationCode: string;
  readonly city: string;
  readonly buildType: StationBuildType;
  readonly isInterchange: boolean;
  readonly platformArrangement: PlatformArrangement;
  /** Conventional asset locations under `public/` — may or may not exist yet; see
   * `useStationAsset` for how absence degrades gracefully rather than erroring. */
  readonly modelPath: string;
  readonly environmentPath: string;
  readonly texturesPath: string;
  /** Free-text disclosure of how confident/approximate this entry's classification is, and what
   * it's based on — required precisely because the spec forbids claiming an approximation is
   * exact. Empty only for a synthesized (uncurated) entry. */
  readonly referenceNotes: string;
  /** `false` for a hand-curated entry in the station dataset; `true` for one synthesized on the
   * fly for a station the dataset has never seen (see `getStationConfig`) — the dashboard's
   * "reconstructed vs procedural" split is this flag, not a separate lookup. */
  readonly synthesized: boolean;
  /** Present only for a station whose real references were analyzed deeply enough to justify
   * station-specific geometry beyond its build type — absent (not zeroed-out) for every other
   * station, so the renderer's fallback path stays the generic shell. */
  readonly architecture?: ArchitecturalProfile | undefined;
}

/** A station's config plus what actually exists on disk right now, resolved once per station
 * selection (see `useStationAsset`) — the thing the renderer and the validation dashboard both
 * consume instead of re-deriving availability themselves. */
export interface ResolvedStationAsset {
  readonly config: StationConfig;
  readonly quality: StationModelQuality;
  readonly modelAvailable: boolean;
  readonly environmentAvailable: boolean;
}
