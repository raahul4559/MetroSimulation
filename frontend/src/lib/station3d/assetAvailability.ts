/**
 * Whether a real asset actually answers at `path` — a plain `HEAD` request, never `useGLTF`
 * itself, so a missing file never throws inside a Suspense boundary or spams a 404 through the
 * GLTF loader. Shared by `useStationAsset` (per-station render decision) and the validation
 * dashboard (network-wide audit) so both agree on exactly the same definition of "available."
 */
export async function checkAssetExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
