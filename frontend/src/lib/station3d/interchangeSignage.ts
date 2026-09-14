import type { Line } from "@/domain/metro";
import type { PlatformLayout3D } from "@/domain/station3d";

/** One platform module's real destinations in both directions — everything the interchange
 * concourse sign prints, derived purely from the line's own real station order (first/last), the
 * same source `trainVisual.ts#destinationName` uses per-train. Not train-specific: this describes
 * what the platform *always* serves, whether or not a train happens to be there right now. */
export interface PlatformDestinations {
  readonly lineCode: string;
  readonly platformNumber: number;
  readonly lineName: string;
  readonly colorHex: string;
  readonly outboundTerminusName: string;
  readonly inboundTerminusName: string;
}

/**
 * Builds the per-platform destination list an interchange's concourse sign needs — "Platform 1 →
 * Whitefield / Kengeri" for every line actually serving this station, in the same order as
 * `StationLayout3D.platforms`. Used only when `StationConfig.isInterchange` is true; a
 * single-line station has nothing here worth a concourse sign for (its one platform sign already
 * shows a live destination).
 */
export function buildPlatformDestinations(
  platforms: readonly PlatformLayout3D[],
  lines: readonly Line[]
): readonly PlatformDestinations[] {
  const lineByCode = new Map(lines.map((l) => [l.code, l] as const));
  return platforms.map((platform) => {
    const line = lineByCode.get(platform.lineCode);
    const outbound = line && line.stations.length > 0 ? line.stations[line.stations.length - 1] : null;
    const inbound = line && line.stations.length > 0 ? line.stations[0] : null;
    return {
      lineCode: platform.lineCode,
      platformNumber: platform.platformNumber,
      lineName: platform.lineName,
      colorHex: platform.colorHex,
      outboundTerminusName: outbound?.name ?? "",
      inboundTerminusName: inbound?.name ?? "",
    };
  });
}
