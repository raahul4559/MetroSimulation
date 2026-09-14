import type { Line, Station } from "@/domain/metro";
import type { PlatformLayout3D, StationLayout3D } from "@/domain/station3d";

/**
 * Builds a station's procedural 3D layout purely from real network data — one platform module per
 * line serving the station (an island platform, a track either side for the two directions), and an
 * overall orientation borrowed from the primary line's real geographic bearing to its neighbor. No
 * station name, coordinate, or platform count is ever hardcoded here; a station this function has
 * never seen before still produces a complete, consistent layout.
 *
 * <p>Every platform module shares the one {@code orientationRadians} rather than each computing its
 * own bearing — a deliberate schematic simplification (see {@link StationLayout3D}'s javadoc)
 * that keeps interchange geometry simple parallel modules instead of angled ones.
 */
export function buildStationLayout3D(
  station: Station,
  lines: readonly Line[],
  stationsById: ReadonlyMap<number, Station>
): StationLayout3D {
  const servingLines = lines.filter((line) => station.lines.includes(line.code));

  const platforms: PlatformLayout3D[] = servingLines.map((line, index) => {
    const stationIndex = line.stations.findIndex((s) => s.id === station.id);
    const outboundNeighbor =
      stationIndex >= 0 && stationIndex < line.stations.length - 1 ? line.stations[stationIndex + 1] : null;
    const inboundNeighbor = stationIndex > 0 ? line.stations[stationIndex - 1] : null;

    return {
      lineCode: line.code,
      lineName: line.name,
      colorHex: line.colorHex,
      moduleIndex: index,
      platformNumber: index + 1,
      outboundNeighborId: outboundNeighbor?.id ?? null,
      inboundNeighborId: inboundNeighbor?.id ?? null,
    };
  });

  const orientationRadians = computeOrientation(station, servingLines[0] ?? null, stationsById);

  return {
    stationId: station.id,
    code: station.code,
    name: station.name,
    stationType: station.stationType,
    orientationRadians,
    platforms,
  };
}

function computeOrientation(station: Station, primaryLine: Line | null, stationsById: ReadonlyMap<number, Station>): number {
  if (!primaryLine) return 0;
  const index = primaryLine.stations.findIndex((s) => s.id === station.id);
  const neighbor =
    index >= 0 && index < primaryLine.stations.length - 1
      ? primaryLine.stations[index + 1]
      : index > 0
        ? primaryLine.stations[index - 1]
        : null;
  if (!neighbor) return 0;
  // stationsById isn't strictly needed (the neighbor object from Line.stations already carries
  // coordinates), but taking it keeps this function's signature consistent with callers that build
  // one anyway and leaves room for a future cross-check against the canonical station record.
  const resolved = stationsById.get(neighbor.id) ?? neighbor;
  return bearingRadians(station, resolved);
}

/** Planar bearing (radians) from `from` to `to`, longitude scaled by cos(latitude) so it's a fair
 * local approximation at Bengaluru's latitude — same spirit as `buildProjector`'s equirectangular
 * fit, not a geodesic. */
function bearingRadians(from: Pick<Station, "latitude" | "longitude">, to: Pick<Station, "latitude" | "longitude">): number {
  const latRad = (from.latitude * Math.PI) / 180;
  const dLng = (to.longitude - from.longitude) * Math.cos(latRad);
  const dLat = to.latitude - from.latitude;
  return Math.atan2(dLng, dLat);
}
