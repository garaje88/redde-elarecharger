import { CalcInputError } from "@elacharger/calc";
import type { Charger, Vehicle } from "@elacharger/schemas";
import { describe, expect, it } from "vitest";
import { estimateForSetup } from "./estimate";
import { durationLabel, endLabel, explanation } from "./explain";

const vehicle = {
  id: "0b8f6a4e-0000-4000-8000-0000000000aa",
  nickname: "Deepal S05",
  is_default: true,
  battery_health_pct: 100,
  variant: null,
  spec: {
    battery_gross_kwh: 56.12,
    battery_usable_kwh: 56.12,
    chemistry: "LFP",
    range_km: 458,
    range_cycle: "NEDC",
    consumption_kwh_100km: null,
    curb_weight_kg: null,
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

const charger = {
  id: "0b8f6a4e-0000-4000-8000-0000000000bb",
  name: "Casa",
  use: "home",
  charger_model: null,
  voltage_v: 220,
  phases: 1,
  circuit_amperage_a: 32,
  connector: null,
  efficiency: null,
  power: { kw: 7.04, limited_by: "circuit", warnings: [] },
  created_at: "2026-11-04T00:00:00Z",
} satisfies Charger;

const setup = { vehicle, charger, startSoc: 20, targetSoc: 80, tariffPerKwh: 900, currency: "COP" };

describe("estimateForSetup", () => {
  it("matches the PLAN Nivel 2 case: 220 V 32 A, on-board 6.6 kW, 20 → 80 % ≈ 5 h 40 min", () => {
    const estimate = estimateForSetup({ ...setup, startAt: new Date("2026-11-04T22:00:00Z") });

    expect(durationLabel(estimate.duration_min)).toBe("5 h 40 min");
    expect(estimate).toMatchObject({
      limited_by: "onboard_charger",
      grid_power_kw: 6.6,
      effective_kw: 5.94,
      cost: expect.closeTo((33.672 / 0.9) * 900, 0),
      currency: "COP",
      ends_at: expect.stringMatching(/^2026-11-05T03:4/),
    });
    expect(estimate.curve[0]).toEqual({ minute: 0, soc: 20, kw: 6.6 });
  });

  it("hides the cost without a tariff and refuses a vehicle without usable battery", () => {
    expect(estimateForSetup({ ...setup, tariffPerKwh: null }).cost).toBeNull();
    const unknown = { ...vehicle, spec: { ...vehicle.spec, battery_usable_kwh: null } };
    expect(() => estimateForSetup({ ...setup, vehicle: unknown })).toThrow(CalcInputError);
  });

  it("uses the charger model rating and a custom efficiency", () => {
    const estimate = estimateForSetup({
      ...setup,
      vehicle: { ...vehicle, spec: { ...vehicle.spec, ac_onboard_kw: 11 } },
      charger: {
        ...charger,
        efficiency: 0.8,
        charger_model: { rated_kw: 3.7 } as Charger["charger_model"],
      },
    });
    expect(estimate).toMatchObject({ limited_by: "charger", grid_power_kw: 3.7, efficiency: 0.8 });
  });
});

describe("labels", () => {
  it("formats durations and end times", () => {
    expect(durationLabel(45)).toBe("45 min");
    const now = new Date(2026, 10, 4, 20, 0);
    expect(endLabel(new Date(2026, 10, 4, 23, 40), now)).toMatch(/^Termina hacia las 11:40/);
    expect(endLabel(new Date(2026, 10, 5, 2, 0), now)).toMatch(/^Termina mañana hacia las 2:00/);
    expect(endLabel(new Date(2026, 10, 6, 2, 0), now)).toMatch(/^Termina el \S+ hacia las/);
  });

  it("explains the calculation with the engine's numbers", () => {
    const lines = explanation(estimateForSetup(setup), { voltage: 220, amperage: 32, phases: 1 });
    expect(lines[0]).toBe("Potencia del circuito: 220 V × 32 A = 7 kW.");
    expect(lines[1]).toContain("6,6 kW, limitada por el cargador a bordo del carro");
    expect(lines[2]).toContain("90 %");
    expect(lines[3]).toContain("95 %");
    expect(
      explanation(estimateForSetup(setup), { voltage: 220, amperage: 16, phases: 3 })[0],
    ).toContain("√3");
  });
});
