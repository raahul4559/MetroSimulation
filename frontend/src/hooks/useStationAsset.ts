import { useEffect, useState } from "react";
import type { ResolvedStationAsset, StationConfig } from "@/domain/stationConfig";
import { checkAssetExists } from "@/lib/station3d/assetAvailability";

function defaultTierFor(config: StationConfig): ResolvedStationAsset {
  return {
    config,
    quality: config.synthesized ? "PROCEDURAL" : "RECONSTRUCTED",
    modelAvailable: false,
    environmentAvailable: false,
  };
}

/**
 * Resolves a station's *runtime* asset tier: `HIGH` only once a real `.glb` actually answers at
 * `config.modelPath`, otherwise the tier `getStationConfig` already implied (`RECONSTRUCTED` for a
 * curated entry, `PROCEDURAL` for a synthesized one) — never a boolean "has asset or not" the way
 * the earlier `useStationGLTFAvailability` worked, since the spec's three tiers need the
 * curated/synthesized distinction even when no `.glb` exists yet.
 *
 * <p>Runs its checks fresh per `config` (per station selection) rather than once at app start —
 * the "don't load everything up front" half of the asset-loading spec. Loading/disposing the
 * actual GLTF once a `HIGH` tier is confirmed is `StationAssetModel`'s job, not this hook's.
 */
export function useStationAsset(config: StationConfig): ResolvedStationAsset {
  const [state, setState] = useState<ResolvedStationAsset>(() => defaultTierFor(config));

  useEffect(() => {
    let cancelled = false;

    // Deferred to a microtask so this reset is async, not synchronous within the effect body
    // (avoids react-hooks/set-state-in-effect) — same pattern used across this feature's hooks.
    Promise.resolve().then(() => {
      if (!cancelled) setState(defaultTierFor(config));
    });

    Promise.all([checkAssetExists(config.modelPath), checkAssetExists(config.environmentPath)]).then(
      ([modelAvailable, environmentAvailable]) => {
        if (cancelled) return;
        setState({
          config,
          quality: modelAvailable ? "HIGH" : config.synthesized ? "PROCEDURAL" : "RECONSTRUCTED",
          modelAvailable,
          environmentAvailable,
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [config]);

  return state;
}
