import type { LatLng, Place } from "@elacharger/schemas";
import { z } from "zod";
import { type RawRoute, RoutingError, type RoutingProvider } from "./provider";

// OpenRouteService (driving-car, elevation). Called only from the server: the key never
// reaches the browser.

const DirectionsResponse = z.object({
  features: z
    .array(
      z.object({
        properties: z.object({
          summary: z.object({ distance: z.number().default(0), duration: z.number().default(0) }),
          ascent: z.number().default(0),
          descent: z.number().default(0),
        }),
        geometry: z.object({ coordinates: z.array(z.array(z.number()).min(2)) }),
      }),
    )
    .min(1),
});

const GeocodeResponse = z.object({
  features: z.array(
    z.object({
      properties: z.object({ label: z.string() }),
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    }),
  ),
});

export class OrsProvider implements RoutingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openrouteservice.org",
    // Resolved per call so instrumentation (and test interceptors) patching fetch apply.
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: this.apiKey,
          Accept: "application/json, application/geo+json",
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new RoutingError("unavailable", `OpenRouteService unreachable: ${String(error)}`);
    }
    if (response.ok) return response.json();
    // 404 and 400 with ORS 20xx codes mean the points cannot be connected by road.
    if (response.status === 404 || response.status === 400) {
      throw new RoutingError("no_route", `OpenRouteService answered ${response.status}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new RoutingError("not_configured", "OpenRouteService rejected the API key");
    }
    throw new RoutingError("unavailable", `OpenRouteService answered ${response.status}`);
  }

  async directions(origin: LatLng, destination: LatLng): Promise<RawRoute> {
    const json = await this.request("/v2/directions/driving-car/geojson", {
      method: "POST",
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        elevation: true,
        instructions: false,
        language: "es",
      }),
    });
    const parsed = DirectionsResponse.safeParse(json);
    if (!parsed.success)
      throw new RoutingError("unavailable", "Unexpected OpenRouteService response");
    const [feature] = parsed.data.features;
    if (!feature) throw new RoutingError("no_route", "No route");
    const { summary, ascent, descent } = feature.properties;
    return {
      distanceKm: summary.distance / 1000,
      durationMin: summary.duration / 60,
      ascentM: ascent,
      descentM: descent,
      points: feature.geometry.coordinates.map(([lng = 0, lat = 0, elevation = 0]) => [
        lng,
        lat,
        elevation,
      ]),
    };
  }

  private async places(path: string): Promise<Place[]> {
    const parsed = GeocodeResponse.safeParse(await this.request(path));
    if (!parsed.success)
      throw new RoutingError("unavailable", "Unexpected OpenRouteService response");
    return parsed.data.features.map((f) => ({
      label: f.properties.label.slice(0, 300),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
  }

  geocode(text: string, focus?: LatLng): Promise<Place[]> {
    const params = new URLSearchParams({ text, size: "6", lang: "es", "boundary.country": "CO" });
    if (focus) {
      params.set("focus.point.lat", String(focus.lat));
      params.set("focus.point.lon", String(focus.lng));
    }
    return this.places(`/geocode/autocomplete?${params}`);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const params = new URLSearchParams({
      "point.lat": String(point.lat),
      "point.lon": String(point.lng),
      size: "1",
      lang: "es",
    });
    const [place] = await this.places(`/geocode/reverse?${params}`);
    return place ?? null;
  }
}
