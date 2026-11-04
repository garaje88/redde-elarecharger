import type { Variant, VehicleOverrides, VehicleSpec } from "@elacharger/schemas";

const EMPTY_SPEC: VehicleSpec = {
  battery_gross_kwh: null,
  battery_usable_kwh: null,
  chemistry: null,
  range_km: null,
  range_cycle: null,
  consumption_kwh_100km: null,
  curb_weight_kg: null,
  ac_onboard_kw: null,
  ac_phases: null,
  dc_max_kw: null,
  connector_ac: null,
  connector_dc: null,
  charge_curve: null,
};

/** The catalog sheet with the user's corrections on top. Pure, so the UI can preview edits. */
export function resolveSpec(variant: Variant | null, overrides: VehicleOverrides): VehicleSpec {
  const base: VehicleSpec = variant
    ? {
        battery_gross_kwh: variant.battery_gross_kwh,
        battery_usable_kwh: variant.battery_usable_kwh,
        chemistry: variant.chemistry,
        range_km: variant.range_km,
        range_cycle: variant.range_cycle,
        consumption_kwh_100km: variant.consumption_kwh_100km,
        curb_weight_kg: variant.curb_weight_kg,
        ac_onboard_kw: variant.ac_onboard_kw,
        ac_phases: variant.ac_phases,
        dc_max_kw: variant.dc_max_kw,
        connector_ac: variant.connector_ac,
        connector_dc: variant.connector_dc,
        charge_curve: variant.charge_curve,
      }
    : EMPTY_SPEC;
  return { ...base, ...overrides };
}

/** Fills the test cycle of a corrected range from the catalog, which the API requires. */
export function completeOverrides(
  base: VehicleSpec,
  overrides: VehicleOverrides,
): VehicleOverrides {
  if (overrides.range_km !== undefined && overrides.range_cycle === undefined && base.range_cycle) {
    return { ...overrides, range_cycle: base.range_cycle };
  }
  return overrides;
}
