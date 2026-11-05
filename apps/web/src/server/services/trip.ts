import "server-only";
import {
  type TripCalculation,
  type TripEstimate,
  TripEstimateSchema,
  type TripRequest,
} from "@elacharger/schemas";
import type { Json } from "@elacharger/types";
import { estimateTripForSetup } from "@/features/trip/estimate";
import { encodePolyline } from "@/lib/polyline";
import { type Db, unwrap } from "../db";
import { notFound } from "../http";
import { getRoute } from "../routing";
import { getProfile } from "./profile";
import { getVehicle } from "./vehicles";

/** F1 estimate with the server's own route; the client never supplies distances or energy. */
export async function estimateTripFor(
  db: Db,
  userId: string,
  request: TripRequest,
): Promise<TripEstimate> {
  const [vehicle, profile, route] = await Promise.all([
    getVehicle(db, userId, request.vehicle_id),
    getProfile(db, userId),
    getRoute(request.origin, request.destination),
  ]);
  const {
    origin,
    destination,
    start_soc,
    passengers,
    cargo_kg,
    air_conditioning,
    style,
    outside_temp_c,
    reserve_pct,
  } = request;
  const options = {
    start_soc,
    passengers,
    cargo_kg,
    air_conditioning,
    style,
    outside_temp_c,
    reserve_pct,
  };
  return estimateTripForSetup({
    vehicle,
    route,
    origin,
    destination,
    options,
    defaultReservePct: profile.reserve_pct,
  });
}

export async function saveTripCalculation(
  db: Db,
  userId: string,
  request: TripRequest,
): Promise<TripCalculation> {
  const [estimate, profile] = await Promise.all([
    estimateTripFor(db, userId, request),
    getProfile(db, userId),
  ]);
  // The history keeps the inputs and results; the drawn line goes to route_polyline only.
  const { route, ...rest } = estimate;
  const { geometry, ...routeSummary } = route;
  const row = unwrap(
    await db
      .from("trip_calculations")
      .insert({
        user_id: userId,
        vehicle_id: estimate.vehicle_id,
        origin_lat: estimate.origin.lat,
        origin_lng: estimate.origin.lng,
        origin_label: estimate.origin.label ?? null,
        dest_lat: estimate.destination.lat,
        dest_lng: estimate.destination.lng,
        dest_label: estimate.destination.label ?? null,
        distance_km: route.distance_km,
        duration_min: route.duration_min,
        ascent_m: route.ascent_m,
        descent_m: route.descent_m,
        // Privacy setting: the user may keep endpoints and results without the full route.
        route_polyline: profile.store_route_geometry ? encodePolyline(geometry) : null,
        start_soc: estimate.start_soc,
        energy_kwh: estimate.energy_kwh,
        consumed_pct: estimate.consumed_pct,
        arrival_soc: Math.max(estimate.arrival_soc, -1000),
        inputs: {
          estimate: { ...rest, route: { ...routeSummary, geometry: [] } },
        } as unknown as NonNullable<Json>,
        engine_version: estimate.engine_version,
      })
      .select("id, created_at")
      .single(),
    "Trip",
  );
  return { ...estimate, id: row.id, created_at: row.created_at };
}

export async function listTripCalculations(db: Db): Promise<TripCalculation[]> {
  const rows = unwrap(
    await db
      .from("trip_calculations")
      .select("id, created_at, inputs")
      .order("created_at", { ascending: false })
      .limit(50),
    "Trips",
  );
  return rows.flatMap((row) => {
    const parsed = TripEstimateSchema.safeParse((row.inputs as { estimate?: unknown }).estimate);
    return parsed.success ? [{ ...parsed.data, id: row.id, created_at: row.created_at }] : [];
  });
}

export async function deleteTripCalculation(db: Db, id: string): Promise<void> {
  const deleted = unwrap(
    await db.from("trip_calculations").delete().eq("id", id).select("id"),
    "Trip",
  );
  if (deleted.length === 0) throw notFound("The trip does not exist.");
}
