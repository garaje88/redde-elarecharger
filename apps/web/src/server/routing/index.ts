import "server-only";
import { segmentsFromProfile } from "@elacharger/calc";
import type { LatLng, Place, Route } from "@elacharger/schemas";
import { cacheLife } from "next/cache";
import { getServerEnv } from "@/env";
import { OrsProvider } from "./ors";
import { type RawRoute, RoutingError, type RoutingProvider } from "./provider";

export { RoutingError };

/** Points sent to the browser for drawing; the full profile is used for the energy. */
const MAX_DRAWN_POINTS = 1200;

let provider: RoutingProvider | null | undefined;

export function getRoutingProvider(): RoutingProvider {
  if (provider === undefined) {
    const env = getServerEnv();
    provider = env.ORS_API_KEY ? new OrsProvider(env.ORS_API_KEY, env.ORS_BASE_URL) : null;
  }
  if (!provider) throw new RoutingError("not_configured", "Set ORS_API_KEY to enable routing.");
  return provider;
}

/** Test hook. */
export function setRoutingProvider(next: RoutingProvider | null | undefined) {
  provider = next;
}

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** ~11 m: nearby taps share the cached route (docs/PLAN.md: "par A→B redondeado"). */
export const roundPoint = (p: LatLng): LatLng => ({ lat: round(p.lat, 4), lng: round(p.lng, 4) });

export function toRoute(raw: RawRoute): Route {
  const step = Math.max(1, Math.ceil(raw.points.length / MAX_DRAWN_POINTS));
  const drawn = raw.points.filter((_, i) => i % step === 0 || i === raw.points.length - 1);
  const lngs = raw.points.map((p) => p[0]);
  const lats = raw.points.map((p) => p[1]);
  const totals = {
    distanceKm: raw.distanceKm,
    durationMin: raw.durationMin,
    ascentM: raw.ascentM,
    descentM: raw.descentM,
  };
  return {
    distance_km: round(raw.distanceKm, 2),
    duration_min: round(raw.durationMin, 1),
    ascent_m: round(raw.ascentM, 1),
    descent_m: round(raw.descentM, 1),
    geometry: drawn.map((p) => [round(p[0], 5), round(p[1], 5)]),
    bbox:
      raw.points.length > 0
        ? [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
        : [0, 0, 0, 0],
    segments: segmentsFromProfile(raw.points, totals).map((s) => ({
      distance_km: round(s.distanceKm, 3),
      duration_min: round(s.durationMin, 2),
      ascent_m: round(s.ascentM, 1),
      descent_m: round(s.descentM, 1),
    })),
  };
}

/** Cached 24 h per rounded A→B pair, shared across users (a route holds no personal data). */
async function cachedRoute(oLat: number, oLng: number, dLat: number, dLng: number): Promise<Route> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 86_400 });
  const raw = await getRoutingProvider().directions(
    { lat: oLat, lng: oLng },
    { lat: dLat, lng: dLng },
  );
  return toRoute(raw);
}

export function getRoute(origin: LatLng, destination: LatLng): Promise<Route> {
  const a = roundPoint(origin);
  const b = roundPoint(destination);
  return cachedRoute(a.lat, a.lng, b.lat, b.lng);
}

async function cachedGeocode(
  text: string,
  lat: number | null,
  lng: number | null,
): Promise<Place[]> {
  "use cache";
  cacheLife("days");
  return getRoutingProvider().geocode(
    text,
    lat !== null && lng !== null ? { lat, lng } : undefined,
  );
}

export function geocode(text: string, focus?: LatLng): Promise<Place[]> {
  // Focus rounded to ~1 km: good enough to rank results, and keeps the cache useful.
  const f = focus ? { lat: round(focus.lat, 2), lng: round(focus.lng, 2) } : null;
  return cachedGeocode(text.trim().toLowerCase(), f?.lat ?? null, f?.lng ?? null);
}

async function cachedReverse(lat: number, lng: number): Promise<Place | null> {
  "use cache";
  cacheLife("days");
  return getRoutingProvider().reverse({ lat, lng });
}

export function reverseGeocode(point: LatLng): Promise<Place | null> {
  const p = roundPoint(point);
  return cachedReverse(p.lat, p.lng);
}
