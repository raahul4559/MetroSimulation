"use client";

import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";

interface StationAssetModelProps {
  modelPath: string;
}

/**
 * Renders a real, station-specific `.glb` — Level 1 (High Fidelity) from the spec. Only ever
 * mounted by `StationModel` once `useStationAsset` has already confirmed the file exists (a plain
 * `HEAD` check, done outside Suspense), so `useGLTF` here always resolves against a real asset
 * rather than being the thing that discovers a 404. Clears the asset from drei's cache on unmount
 * or path change — the "dispose unnecessary resources" half of the asset-loading spec, since
 * nothing else keeps a station's model around once the operator leaves it.
 */
export function StationAssetModel({ modelPath }: StationAssetModelProps) {
  const gltf = useGLTF(modelPath);

  useEffect(() => {
    return () => useGLTF.clear(modelPath);
  }, [modelPath]);

  return <primitive object={gltf.scene} />;
}
