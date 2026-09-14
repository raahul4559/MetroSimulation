import type { Station } from "@/domain/metro";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

export type Projector = (station: Pick<Station, "latitude" | "longitude">) => Point;

/**
 * Builds a pure lat/lng -> SVG (x, y) projector for a fixed set of stations.
 *
 * This is a simple equirectangular fit-to-viewport projection, not a manually authored
 * schematic layout — it keeps the map's relative geography recognisable without any map
 * tiles or external dependency. Latitude is a real-world-plausible value (see data/README.md),
 * not survey-grade, and is flipped because SVG y grows downward while latitude grows northward.
 */
export function buildProjector(stations: readonly Station[], viewport: Viewport): Projector {
  if (stations.length === 0) {
    return () => ({ x: viewport.width / 2, y: viewport.height / 2 });
  }

  const latitudes = stations.map((s) => s.latitude);
  const longitudes = stations.map((s) => s.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;

  const innerWidth = viewport.width - viewport.padding * 2;
  const innerHeight = viewport.height - viewport.padding * 2;

  return ({ latitude, longitude }) => ({
    x: viewport.padding + ((longitude - minLng) / lngSpan) * innerWidth,
    y: viewport.padding + (1 - (latitude - minLat) / latSpan) * innerHeight,
  });
}
