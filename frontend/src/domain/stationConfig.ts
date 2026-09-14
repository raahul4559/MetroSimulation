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
