import type { Line, Station, Track } from "@/domain/metro";

/** Lines serving a station, resolved from its `lineCodes` against the full line list. */
export function getLinesForStation(station: Station, lines: readonly Line[]): Line[] {
  const codes = new Set(station.lines);
  return lines.filter((line) => codes.has(line.code));
}

export interface NeighborStation {
  readonly station: Station;
  readonly lineCode: string;
  readonly distanceMetres: number;
  readonly travelTimeSeconds: number;
}

/** Stations directly reachable from `station` by a single track, derived from the track graph. */
export function getNeighborStations(
  station: Station,
  tracks: readonly Track[],
  stationsById: ReadonlyMap<number, Station>
): NeighborStation[] {
  return tracks
    .filter((track) => track.fromStationId === station.id || track.toStationId === station.id)
    .map((track) => {
      const neighborId = track.fromStationId === station.id ? track.toStationId : track.fromStationId;
      const neighbor = stationsById.get(neighborId);
      return neighbor
        ? {
            station: neighbor,
            lineCode: track.lineCode,
            distanceMetres: track.distanceMetres,
            travelTimeSeconds: track.expectedTravelTimeSeconds,
          }
        : null;
    })
    .filter((n): n is NeighborStation => n !== null);
}

export function buildStationIndex(stations: readonly Station[]): Map<number, Station> {
  return new Map(stations.map((station) => [station.id, station]));
}
