import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import directions from "../../../../../tests/fixtures/ors/directions.json";
import places from "../../../../../tests/fixtures/ors/places.json";
import { toRoute } from "./index";
import { OrsProvider } from "./ors";
import { RoutingError } from "./provider";

const BASE = "https://ors.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ors = new OrsProvider("test-key", BASE);
const bogota = { lat: places.bogota.lat, lng: places.bogota.lng };
const girardot = { lat: places.girardot.lat, lng: places.girardot.lng };

describe("OrsProvider", () => {
  it("requests a driving route with elevation and maps the totals", async () => {
    let body: unknown;
    let auth: string | null = null;
    server.use(
      http.post(`${BASE}/v2/directions/driving-car/geojson`, async ({ request }) => {
        body = await request.json();
        auth = request.headers.get("authorization");
        return HttpResponse.json(directions);
      }),
    );

    const raw = await ors.directions(bogota, girardot);

    expect(auth).toBe("test-key");
    expect(body).toMatchObject({
      coordinates: [
        [bogota.lng, bogota.lat],
        [girardot.lng, girardot.lat],
      ],
      elevation: true,
    });
    expect(raw).toMatchObject({ distanceKm: 135, durationMin: 150, ascentM: 400, descentM: 2700 });
    expect(raw.points[0]).toEqual([-74.0721, 4.711, 2600]);
  });

  it("geocodes within Colombia and reverse-geocodes taps", async () => {
    let query: URLSearchParams | undefined;
    const fc = (p: { label: string; lng: number; lat: number }) => ({
      features: [{ properties: { label: p.label }, geometry: { coordinates: [p.lng, p.lat] } }],
    });
    server.use(
      http.get(`${BASE}/geocode/autocomplete`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json(fc(places.girardot));
      }),
      http.get(`${BASE}/geocode/reverse`, () => HttpResponse.json({ features: [] })),
    );

    expect(await ors.geocode("girardot", bogota)).toEqual([places.girardot]);
    expect(query?.get("boundary.country")).toBe("CO");
    expect(query?.get("focus.point.lat")).toBe(String(bogota.lat));
    expect(await ors.reverse(bogota)).toBeNull();
  });

  it.each([
    [404, "no_route"],
    [400, "no_route"],
    [403, "not_configured"],
    [429, "unavailable"],
    [500, "unavailable"],
  ])("maps HTTP %d to %s", async (status, kind) => {
    server.use(
      http.post(`${BASE}/v2/directions/driving-car/geojson`, () =>
        HttpResponse.json({}, { status }),
      ),
    );
    await expect(ors.directions(bogota, girardot)).rejects.toMatchObject({ kind });
  });

  it("rejects malformed responses and network failures", async () => {
    server.use(
      http.post(`${BASE}/v2/directions/driving-car/geojson`, () =>
        HttpResponse.json({ features: [] }),
      ),
      http.get(`${BASE}/geocode/autocomplete`, () => HttpResponse.error()),
    );
    await expect(ors.directions(bogota, girardot)).rejects.toBeInstanceOf(RoutingError);
    await expect(ors.geocode("x")).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("toRoute", () => {
  it("segments the profile and keeps the router totals", async () => {
    server.use(
      http.post(`${BASE}/v2/directions/driving-car/geojson`, () => HttpResponse.json(directions)),
    );
    const route = toRoute(await ors.directions(bogota, girardot));

    expect(route).toMatchObject({
      distance_km: 135,
      duration_min: 150,
      ascent_m: 400,
      descent_m: 2700,
    });
    expect(route.bbox).toEqual([-74.803, 4.303, -74.0721, 4.711]);
    expect(route.segments.length).toBeGreaterThan(5);
    const total = (key: "distance_km" | "ascent_m" | "descent_m") =>
      route.segments.reduce((sum, s) => sum + s[key], 0);
    expect(total("distance_km")).toBeCloseTo(135, 1);
    expect(total("ascent_m")).toBeCloseTo(400, 0);
    expect(total("descent_m")).toBeCloseTo(2700, 0);
    // The climb happens in the first segments only.
    expect(route.segments.at(-1)?.ascent_m).toBe(0);
  });
});
