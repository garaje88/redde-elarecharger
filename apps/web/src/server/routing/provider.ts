import type { LatLng, Place } from "@elacharger/schemas";

/** Router output before segmentation: totals and the elevation profile. */
export interface RawRoute {
  distanceKm: number;
  durationMin: number;
  ascentM: number;
  descentM: number;
  /** [lng, lat, elevation m]. */
  points: [number, number, number][];
}

/**
 * The map/routing vendor sits behind this interface so OpenRouteService can be swapped for
 * Mapbox or Google Routes without touching the engine (docs/PLAN.md, Stack).
 */
export interface RoutingProvider {
  directions(origin: LatLng, destination: LatLng): Promise<RawRoute>;
  geocode(text: string, focus?: LatLng): Promise<Place[]>;
  reverse(point: LatLng): Promise<Place | null>;
}

export class RoutingError extends Error {
  constructor(
    readonly kind: "no_route" | "unavailable" | "not_configured",
    message: string,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}
