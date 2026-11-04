import {
  CalcInputError,
  ENGINE_VERSION,
  estimateTrip,
  estimatedCurbWeightKg,
} from "@elacharger/calc";
import type { Route, TripEstimate, TripOptions, Vehicle } from "@elacharger/schemas";

// One mapping from the user's vehicle and a route to the engine, shared by the live result in the
// browser and the API.

type Point = TripEstimate["origin"];

export interface TripSetup {
  vehicle: Vehicle;
  route: Route;
  origin: Point;
  destination: Point;
  options: TripOptions;
  /** The user's reserve when the request does not set one. */
  defaultReservePct: number;
}

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

export function estimateTripForSetup({
  vehicle,
  route,
  origin,
  destination,
  options,
  defaultReservePct,
}: TripSetup): TripEstimate {
  const { spec } = vehicle;
  if (spec.battery_usable_kwh === null) {
    throw new CalcInputError("vehicle.usableKwh", "The vehicle's usable battery is unknown.");
  }
  const curbWeightKg = spec.curb_weight_kg ?? estimatedCurbWeightKg(spec.battery_usable_kwh);
  const reservePct = options.reserve_pct ?? defaultReservePct;

  const result = estimateTrip({
    vehicle: {
      usableKwh: spec.battery_usable_kwh,
      curbWeightKg,
      consumptionKwh100km: spec.consumption_kwh_100km,
      rangeKm: spec.range_km,
      rangeCycle: spec.range_cycle,
      batteryHealthPct: vehicle.battery_health_pct,
    },
    segments: route.segments.map((s) => ({
      distanceKm: s.distance_km,
      durationMin: s.duration_min,
      ascentM: s.ascent_m,
      descentM: s.descent_m,
    })),
    startSocPct: options.start_soc,
    passengers: options.passengers,
    cargoKg: options.cargo_kg,
    airConditioning: options.air_conditioning,
    style: options.style,
    outsideTempC: options.outside_temp_c,
    reservePct,
  });

  return {
    vehicle_id: vehicle.id,
    origin,
    destination,
    route,
    start_soc: options.start_soc,
    energy_kwh: result.energyKwh,
    energy_range_kwh: result.energyRangeKwh,
    consumed_pct: result.consumedPct,
    arrival_soc: result.arrivalSocPct,
    arrival_soc_range: result.arrivalSocRangePct,
    remaining_range_km: result.remainingRangeKm,
    reachable: result.reachable,
    below_reserve: result.belowReserve,
    reserve_pct: result.reservePct,
    breakdown: {
      base_consumption_kwh_100km: round(result.breakdown.baseConsumptionKwh100km, 2),
      usable_kwh: result.breakdown.usableKwh,
      mass_kg: result.breakdown.massKg,
      curb_weight_estimated: spec.curb_weight_kg === null,
      style_factor: result.breakdown.styleFactor,
      climate_factor: result.breakdown.climateFactor,
      air_conditioning_factor: result.breakdown.airConditioningFactor,
      driving_kwh: result.breakdown.drivingKwh,
      climb_kwh: result.breakdown.climbKwh,
      regen_kwh: result.breakdown.regenKwh,
    },
    options: { ...options, reserve_pct: reservePct },
    engine_version: ENGINE_VERSION,
  };
}

/** Traffic light of the result (docs/PLAN.md UX): green, amber within 10 points of the reserve, red. */
export function tripStatus(
  estimate: Pick<TripEstimate, "arrival_soc" | "reserve_pct">,
): "ok" | "tight" | "short" {
  if (estimate.arrival_soc < estimate.reserve_pct) return "short";
  if (estimate.arrival_soc < estimate.reserve_pct + 10) return "tight";
  return "ok";
}
