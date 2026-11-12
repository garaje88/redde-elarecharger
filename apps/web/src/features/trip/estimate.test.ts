import { CalcInputError } from "@elacharger/calc";
import type { Route, TripOptions, Vehicle } from "@elacharger/schemas";
import { describe, expect, it } from "vitest";
import { estimateTripForSetup, tripStatus } from "./estimate";

const vehicle = {
  id: "0b8f6a4e-0000-4000-8000-0000000000aa",
  nickname: "Deepal S05",
  is_default: true,
  battery_health_pct: 100,
  current_soc: null,
  current_soc_at: null,
  variant: null,
  spec: {
    battery_gross_kwh: 56.12,
    battery_usable_kwh: 56.12,
    chemistry: "LFP",
    range_km: 458,
    range_cycle: "NEDC",
    consumption_kwh_100km: null,
    curb_weight_kg: 1852,
    ac_onboard_kw: 6.6,
    ac_phases: 1,
    dc_max_kw: null,
    connector_ac: null,
    connector_dc: null,
    charge_curve: null,
  },
  overrides: {},
  field_sources: {},
  created_at: "2026-11-04T00:00:00Z",
} satisfies Vehicle;

const flat: Route = {
  distance_km: 100,
  duration_min: 90,
  ascent_m: 0,
  descent_m: 0,
  geometry: [],
  bbox: [0, 0, 0, 0],
  segments: [{ distance_km: 100, duration_min: 90, ascent_m: 0, descent_m: 0 }],
};

const options: TripOptions = {
  start_soc: 100,
  passengers: 1,
  cargo_kg: 0,
  air_conditioning: false,
  style: "normal",
  outside_temp_c: null,
};

const setup = {
  vehicle,
  route: flat,
  origin: { lat: 4.7, lng: -74.07, label: "A" },
  destination: { lat: 4.3, lng: -74.8, label: "B" },
  options,
  defaultReservePct: 10,
};

describe("estimateTripForSetup", () => {
  it("matches the PLAN flat case: 100 km, normal, no A/C → 15.9 kWh, 28.3 %", () => {
    const estimate = estimateTripForSetup(setup);
    expect(estimate.energy_kwh).toBeCloseTo(15.93, 1);
    expect(estimate.consumed_pct).toBeCloseTo(28.38, 1);
    expect(estimate).toMatchObject({ reserve_pct: 10, reachable: true, below_reserve: false });
    expect(estimate.breakdown).toMatchObject({ mass_kg: 1927, curb_weight_estimated: false });
    expect(estimate.options.reserve_pct).toBe(10);
  });

  it("estimates the curb weight when the sheet lacks it and flags it", () => {
    const light = { ...vehicle, spec: { ...vehicle.spec, curb_weight_kg: null } };
    expect(estimateTripForSetup({ ...setup, vehicle: light }).breakdown).toMatchObject({
      curb_weight_estimated: true,
      mass_kg: 1849 + 75,
    });
  });

  it("uses the request's reserve over the profile's", () => {
    const estimate = estimateTripForSetup({
      ...setup,
      options: { ...options, start_soc: 35, reserve_pct: 20 },
    });
    expect(estimate).toMatchObject({ reserve_pct: 20, below_reserve: true });
  });

  it("refuses a vehicle without usable battery", () => {
    const unknown = { ...vehicle, spec: { ...vehicle.spec, battery_usable_kwh: null } };
    expect(() => estimateTripForSetup({ ...setup, vehicle: unknown })).toThrow(CalcInputError);
  });
});

describe("tripStatus", () => {
  it("is green with margin, amber near the reserve and red below it", () => {
    expect(tripStatus({ arrival_soc: 40, reserve_pct: 10 })).toBe("ok");
    expect(tripStatus({ arrival_soc: 15, reserve_pct: 10 })).toBe("tight");
    expect(tripStatus({ arrival_soc: 5, reserve_pct: 10 })).toBe("short");
  });
});
