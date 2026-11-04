import { CalcInputError, ENGINE_VERSION, estimateCharge } from "@elacharger/calc";
import type { Charger, ChargeEstimate, Vehicle } from "@elacharger/schemas";

// One mapping from garage records to the engine, shared by the live result in the browser and
// the API, so what the user sees is exactly what gets saved.

export interface ChargeSetup {
  vehicle: Vehicle;
  charger: Charger;
  startSoc: number;
  targetSoc: number;
  startAt?: Date;
  tariffPerKwh: number | null;
  currency: string;
}

export function estimateForSetup({
  vehicle,
  charger,
  startSoc,
  targetSoc,
  startAt,
  tariffPerKwh,
  currency,
}: ChargeSetup): ChargeEstimate {
  const { spec } = vehicle;
  if (spec.battery_usable_kwh === null) {
    throw new CalcInputError("vehicle.usableKwh", "The vehicle's usable battery is unknown.");
  }

  const result = estimateCharge({
    vehicle: {
      usableKwh: spec.battery_usable_kwh,
      batteryHealthPct: vehicle.battery_health_pct,
      acOnboardKw: spec.ac_onboard_kw,
      dcMaxKw: spec.dc_max_kw,
      chargeCurve: spec.charge_curve,
      consumptionKwh100km: spec.consumption_kwh_100km,
      rangeKm: spec.range_km,
      rangeCycle: spec.range_cycle,
    },
    charger: {
      current: "AC",
      voltageV: charger.voltage_v,
      currentA: charger.circuit_amperage_a,
      phases: charger.phases,
      ratedKw: charger.charger_model?.rated_kw ?? null,
      efficiency: charger.efficiency,
    },
    startSocPct: startSoc,
    targetSocPct: targetSoc,
    tariffPerKwh,
    ...(startAt ? { startAt } : {}),
  });

  return {
    vehicle_id: vehicle.id,
    charger_id: charger.id,
    start_soc: startSoc,
    target_soc: targetSoc,
    grid_power_kw: result.gridPowerKw,
    effective_kw: result.effectiveKw,
    limited_by: result.limitedBy,
    efficiency: result.efficiency,
    duration_min: result.durationMin,
    ends_at: result.endsAt?.toISOString() ?? null,
    battery_kwh: result.batteryKwh,
    grid_kwh: result.gridKwh,
    tariff_per_kwh: tariffPerKwh,
    currency,
    cost: result.cost,
    range_gained_km: result.rangeGainedKm,
    curve: result.curve.map((point) => ({
      minute: point.minute,
      soc: point.socPct,
      kw: point.powerKw,
    })),
    warnings: result.warnings,
    engine_version: ENGINE_VERSION,
  };
}
