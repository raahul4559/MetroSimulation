import type { Line, Station } from "@/domain/metro";
import type { StationBuildType, StationConfig } from "@/domain/stationConfig";

/**
 * The central station configuration the whole spec asks for: one entry per operational station,
 * covering physical construction type, interchange-ness, and where its 3D assets live — never
 * hardcoded inside a React component. Curated here from publicly known Namma Metro alignment
 * facts; every entry says in `referenceNotes` how confident that classification is, because none
 * of this is sourced from as-built drawings and shouldn't be presented as if it were.
 *
 * <p>This is deliberately NOT exhaustive of every station Namma Metro operates — `data/metro`
 * models a reduced set of major stations for the simulation. As that dataset grows,
 * {@link getStationConfig} synthesizes a reasonable entry for anything not curated here, so this
 * file only needs a new entry when someone wants a station's classification to be more than the
 * generic default (see its own doc comment for exactly what "reasonable" means).
 */
const CURATED_STATION_CONFIGS: Readonly<Record<string, StationConfig>> = buildCuratedConfigs([
  {
    code: "KENGERI",
    buildType: "ELEVATED",
    notes:
      "Purple Line's western terminus, on an elevated viaduct alongside Mysore Road — high-confidence classification, approximate dimensions/detailing.",
  },
  {
    code: "NAYANDAHALLI",
    buildType: "ELEVATED",
    notes: "Elevated Purple Line station on the western stretch; high-confidence classification.",
  },
  {
    code: "VIJAYANAGAR",
    buildType: "ELEVATED",
    notes: "Elevated Purple Line station; high-confidence classification.",
  },
  {
    code: "MAGADI_ROAD",
    buildType: "ELEVATED",
    notes:
      "Elevated Purple Line station just before the line dips underground toward Majestic; high-confidence classification.",
  },
  {
    code: "MAJESTIC",
    buildType: "UNDERGROUND",
    isInterchange: true,
    notes:
      "Nadaprabhu Kempegowda (Majestic) — the network's central underground interchange between the Purple and Green Lines, next to the City Railway Station and KSR bus stand. Well-documented as underground; exact concourse geometry here is an illustrative approximation, not survey-accurate.",
  },
  {
    code: "MG_ROAD",
    buildType: "UNDERGROUND",
    notes:
      "Underground Purple Line station beneath MG Road, adjacent to Cubbon Park — high-confidence classification, approximate detailing.",
  },
  {
    code: "INDIRANAGAR",
    buildType: "ELEVATED",
    notes: "Elevated Purple Line station on 100 Feet Road; high-confidence classification.",
  },
  {
    code: "BAIYAPPANAHALLI",
    buildType: "ELEVATED",
    notes:
      "Elevated station, historically the Purple Line's eastern terminus and depot access point; high-confidence classification.",
  },
  {
    code: "WHITEFIELD",
    buildType: "ELEVATED",
    notes:
      "Elevated station (Kadugodi/Whitefield extension terminus); high-confidence classification.",
  },
  {
    code: "NAGASANDRA",
    buildType: "ELEVATED",
    notes: "Elevated Green Line northern terminus; high-confidence classification.",
  },
  {
    code: "YESHWANTPUR",
    buildType: "ELEVATED",
    notes: "Elevated Green Line station near Yeshwantpur railway station; high-confidence classification.",
  },
  {
    code: "MAHALAKSHMI",
    buildType: "ELEVATED",
    notes: "Elevated Green Line station; high-confidence classification.",
  },
  {
    code: "LALBAGH",
    buildType: "UNDERGROUND",
    notes:
      "Underground Green Line station on the Majestic–RV Road underground stretch, near Lalbagh Botanical Garden's west gate — moderate confidence, approximate detailing.",
  },
  {
    code: "JAYANAGAR",
    buildType: "ELEVATED",
    notes: "Elevated Green Line station, where the line resurfaces south of the underground stretch; high-confidence classification.",
  },
  {
    code: "RV_ROAD",
    buildType: "ELEVATED",
    isInterchange: true,
    notes:
      "Elevated interchange between the Green Line and the (fully elevated) Yellow Line — high-confidence classification, approximate concourse/transfer geometry.",
  },
  {
    code: "YELACHENAHALLI",
    buildType: "ELEVATED",
    notes: "Elevated Green Line southern terminus; high-confidence classification.",
  },
  {
    code: "JAYADEVA_HOSPITAL",
    buildType: "ELEVATED",
    notes:
      "Elevated Yellow Line station, part of a combined road/metro flyover interchange — high-confidence on construction type, simplified detailing.",
  },
  {
    code: "CENTRAL_SILK_BOARD",
    buildType: "ELEVATED",
    notes: "Elevated Yellow Line station above the Silk Board junction; high-confidence classification.",
  },
  {
    code: "ELECTRONIC_CITY",
    buildType: "ELEVATED",
    notes: "Elevated Yellow Line station along Hosur Road; high-confidence classification.",
  },
  {
    code: "HEBBAGODI",
    buildType: "ELEVATED",
    notes: "Elevated Yellow Line station; high-confidence classification.",
  },
  {
    code: "BOMMASANDRA",
    buildType: "ELEVATED",
    notes: "Elevated Yellow Line southern terminus; high-confidence classification.",
  },
]);

/**
 * Note on coverage: Namma Metro's current operational network is entirely elevated or
 * underground — no at-grade (ground-level) station exists yet. `AT_GRADE` is fully implemented in
 * the renderer (see `components/station3d/environments`) so a future station — a depot-adjacent
 * stop, for instance — needs only a new entry here with `buildType: "AT_GRADE"`, not new code.
 */
export type { StationBuildType };

function buildCuratedConfigs(
  entries: readonly { code: string; buildType: StationBuildType; isInterchange?: boolean; notes: string }[]
): Record<string, StationConfig> {
  const map: Record<string, StationConfig> = {};
  for (const entry of entries) {
    const id = slugify(entry.code);
    map[entry.code] = {
      id,
      stationCode: entry.code,
      city: "Bengaluru",
      buildType: entry.buildType,
      isInterchange: entry.isInterchange ?? false,
      platformArrangement: "ISLAND",
      modelPath: `/stations/${id}/model.glb`,
      environmentPath: `/stations/${id}/environment.glb`,
      texturesPath: `/stations/${id}/textures/`,
      referenceNotes: entry.notes,
      synthesized: false,
    };
  }
  return map;
}

/**
 * Resolves a station's config: the curated entry if one exists, otherwise a synthesized default
 * derived purely from real `Station`/`Line` data — the mechanism that keeps the dataset
 * "updateable" per the spec. A brand-new station added to `data/metro` tomorrow, with no curated
 * entry at all, still resolves to a complete, sensible config today:
 *
 * - `buildType` defaults to `ELEVATED` — the overwhelmingly common case for this network — rather
 *   than guessing something more specific with no evidence.
 * - `isInterchange` is read straight off how many lines actually serve the station, so it can
 *   never drift out of sync with the real network graph the way a hand-authored flag could.
 */
export function getStationConfig(station: Station, lines: readonly Line[]): StationConfig {
  const curated = CURATED_STATION_CONFIGS[station.code];
  if (curated) return curated;

  const id = slugify(station.code);
  const isInterchange = station.lines.length > 1 || lines.filter((l) => l.stations.some((s) => s.id === station.id)).length > 1;

  return {
    id,
    stationCode: station.code,
    city: "Bengaluru",
    buildType: "ELEVATED",
    isInterchange,
    platformArrangement: "ISLAND",
    modelPath: `/stations/${id}/model.glb`,
    environmentPath: `/stations/${id}/environment.glb`,
    texturesPath: `/stations/${id}/textures/`,
    referenceNotes:
      "No curated entry for this station yet — synthesized from network data (defaults to ELEVATED). Add an entry to stationConfigs.ts once its real construction type is known.",
    synthesized: true,
  };
}

/** Every curated entry, for the validation dashboard's "N stations configured" summary — never
 * used by the render path itself, which always goes through {@link getStationConfig}. */
export function listCuratedStationConfigs(): readonly StationConfig[] {
  return Object.values(CURATED_STATION_CONFIGS);
}

function slugify(code: string): string {
  return code.toLowerCase().replace(/_/g, "-");
}
