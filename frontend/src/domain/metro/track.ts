export interface GeometryPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Track {
  readonly id: number;
  readonly lineCode: string;
  readonly fromStationId: number;
  readonly toStationId: number;
  readonly distanceMetres: number;
  readonly expectedTravelTimeSeconds: number;
  readonly geometry: readonly GeometryPoint[];
}
