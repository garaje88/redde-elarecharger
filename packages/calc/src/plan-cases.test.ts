// The six mandatory cases from docs/PLAN.md (F2, "Casos de prueba obligatorios").
import { describe, expect, it } from "vitest";
import { estimateCharge, splitDuration } from "./charging";
import { CalcInputError } from "./errors";
import { DEEPAL_S05 } from "./test/fixtures";
import { estimateTrip } from "./trip";

const within = (actual: number, expected: number, tolerance: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe("PLAN F2 cases, usable battery 56.12 kWh", () => {
  it("Nivel 1 doméstico: 110 V, 12 A, 20 → 80 % ≈ 1.12 kW effective, ~30 h", () => {
    const result = estimateCharge({
      vehicle: DEEPAL_S05,
      charger: { current: "AC", voltageV: 110, currentA: 12, phases: 1 },
      startSocPct: 20,
      targetSocPct: 80,
    });

    within(result.effectiveKw, 1.12, 0.01);
    within(result.durationMin / 60, 30, 0.5);
  });

  it("Nivel 2 doméstico: 220 V, 32 A, on-board 6.6 kW, 20 → 80 % ≈ 5.9 kW, ~5 h 40 min", () => {
    const result = estimateCharge({
      vehicle: { ...DEEPAL_S05, acOnboardKw: 6.6 },
      charger: { current: "AC", voltageV: 220, currentA: 32, phases: 1 },
      startSocPct: 20,
      targetSocPct: 80,
    });

    within(result.effectiveKw, 5.9, 0.05);
    expect(result.limitedBy).toBe("onboard_charger");
    expect(splitDuration(result.durationMin)).toEqual({ hours: 5, minutes: 40 });
  });

  it("Rápido DC: 60 kW, 30 → 100 % ≈ 60 min (sheet calibration)", () => {
    const result = estimateCharge({
      vehicle: DEEPAL_S05,
      charger: { current: "DC", ratedKw: 60 },
      startSocPct: 30,
      targetSocPct: 100,
    });

    // The default curve gives 57.5 min; the sheet says ~60 min: within the ±10 % margin.
    within(result.durationMin, 60, 6);
  });

  it("Objetivo menor que actual: 80 → 50 % is a validation error", () => {
    const run = () =>
      estimateCharge({
        vehicle: DEEPAL_S05,
        charger: { current: "AC", voltageV: 220, currentA: 16, phases: 1 },
        startSocPct: 80,
        targetSocPct: 50,
      });

    expect(run).toThrow(CalcInputError);
    expect(run).toThrow(expect.objectContaining({ field: "targetSocPct" }));
  });
});

describe("PLAN F1 cases", () => {
  const flat = { distanceKm: 100, durationMin: 90, ascentM: 0, descentM: 0 };

  it("Trayecto plano: 100 km, 0 m, normal, no A/C → 15.9 kWh, 28.3 %", () => {
    const result = estimateTrip({
      vehicle: DEEPAL_S05,
      segments: [flat],
      startSocPct: 100,
      style: "normal",
      airConditioning: false,
    });

    within(result.energyKwh, 15.9, 0.05);
    within(result.consumedPct, 28.3, 0.1);
  });

  it("Subida: +1,000 m net with 1,927 kg adds ≈ 5.8 kWh over flat", () => {
    const base = { vehicle: DEEPAL_S05, startSocPct: 100, passengers: 1 } as const;
    const flatTrip = estimateTrip({ ...base, segments: [flat] });
    const climbTrip = estimateTrip({ ...base, segments: [{ ...flat, ascentM: 1000 }] });

    expect(climbTrip.breakdown.massKg).toBe(1927);
    within(climbTrip.energyKwh - flatTrip.energyKwh, 5.8, 0.05);
  });
});
