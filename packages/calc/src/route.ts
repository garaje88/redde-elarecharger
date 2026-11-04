import { assertNonNegative, assertPositive } from "./errors";
import type { TripSegment } from "./trip";

/** A route vertex: [longitude, latitude, elevation in m]. */
export type RoutePoint = readonly [number, number, number];

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two route points, in km. */
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface RouteTotals {
  distanceKm: number;
  durationMin: number;
  ascentM: number;
  descentM: number;
}

/**
 * Splits a routed line into segments of about `chunkKm` so climbs and descents are charged
 * where they happen (F1: "se calcula por segmento y se suma"). Elevation noise below
 * `noiseM` is ignored, then each segment is scaled so the sums match the router's totals.
 */
export function segmentsFromProfile(
  points: readonly RoutePoint[],
  totals: RouteTotals,
  chunkKm = 10,
  noiseM = 3,
): TripSegment[] {
  assertNonNegative("distanceKm", totals.distanceKm);
  assertNonNegative("durationMin", totals.durationMin);
  assertPositive("chunkKm", chunkKm);
  const whole: TripSegment[] = [
    {
      distanceKm: totals.distanceKm,
      durationMin: totals.durationMin,
      ascentM: totals.ascentM,
      descentM: totals.descentM,
    },
  ];
  if (points.length < 2) return whole;

  const raw: { km: number; up: number; down: number }[] = [];
  let current = { km: 0, up: 0, down: 0 };
  let reference = points[0] as RoutePoint;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1] as RoutePoint;
    const point = points[i] as RoutePoint;
    current.km += haversineKm(prev, point);
    // Hysteresis: count a change only once it exceeds the noise band.
    const delta = point[2] - reference[2];
    if (Math.abs(delta) >= noiseM) {
      if (delta > 0) current.up += delta;
      else current.down -= delta;
      reference = point;
    }
    if (current.km >= chunkKm || i === points.length - 1) {
      raw.push(current);
      current = { km: 0, up: 0, down: 0 };
    }
  }

  const sum = raw.reduce(
    (acc, s) => ({ km: acc.km + s.km, up: acc.up + s.up, down: acc.down + s.down }),
    {
      km: 0,
      up: 0,
      down: 0,
    },
  );
  if (sum.km === 0) return whole;

  return raw.map((s) => ({
    distanceKm: (s.km / sum.km) * totals.distanceKm,
    durationMin: (s.km / sum.km) * totals.durationMin,
    ascentM: sum.up > 0 ? (s.up / sum.up) * totals.ascentM : (s.km / sum.km) * totals.ascentM,
    descentM:
      sum.down > 0 ? (s.down / sum.down) * totals.descentM : (s.km / sum.km) * totals.descentM,
  }));
}

/**
 * Rough curb weight when the sheet does not give it: ~1,400 kg plus ~8 kg per usable kWh
 * (Deepal S05: 56 kWh → ~1,850 kg). Only a fallback; the UI flags it as an estimate.
 */
export function estimatedCurbWeightKg(usableKwh: number): number {
  assertPositive("usableKwh", usableKwh);
  return Math.round(1400 + 8 * usableKwh);
}
