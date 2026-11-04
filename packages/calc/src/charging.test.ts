import { describe, expect, it } from "vitest";
import {
  type ChargeInput,
  acPowerKw,
  dcPowerKw,
  estimateCharge,
  homeChargerPower,
  splitDuration,
} from "./charging";
import { CalcInputError } from "./errors";
import { DEEPAL_S05 } from "./test/fixtures";

const ac220: ChargeInput["charger"] = { current: "AC", voltageV: 220, currentA: 32, phases: 1 };
const base: ChargeInput = {
  vehicle: DEEPAL_S05,
  charger: ac220,
  startSocPct: 20,
  targetSocPct: 80,
};

describe("acPowerKw", () => {
  it("multiplies by √3 on three-phase circuits", () => {
    const { kw, by } = acPowerKw({ current: "AC", voltageV: 220, currentA: 16, phases: 3 });
    expect(kw).toBeCloseTo((220 * 16 * Math.sqrt(3)) / 1000, 6);
    expect(by).toBe("circuit");
  });

  it("is capped by the charger rating", () => {
    expect(acPowerKw({ ...ac220, ratedKw: 3.7 } as never, 11)).toEqual({ kw: 3.7, by: "charger" });
  });

  it("ignores unknown limits", () => {
    expect(acPowerKw({ ...ac220, ratedKw: null } as never, null).by).toBe("circuit");
  });
});

describe("dcPowerKw", () => {
  it("is capped by the vehicle DC maximum", () => {
    expect(dcPowerKw({ current: "DC", ratedKw: 150 }, 90)).toEqual({ kw: 90, by: "vehicle_dc" });
  });
});

describe("estimateCharge", () => {
  it("reports energy, cost and end time", () => {
    const startAt = new Date("2026-11-03T20:00:00Z");
    const result = estimateCharge({
      ...base,
      vehicle: { ...DEEPAL_S05, acOnboardKw: 6.6 },
      tariffPerKwh: 900,
      startAt,
    });

    expect(result.batteryKwh).toBeCloseTo(33.672, 3);
    expect(result.gridKwh).toBeCloseTo(33.672 / 0.9, 3);
    expect(result.cost).toBeCloseTo((33.672 / 0.9) * 900, 0);
    expect(result.endsAt?.getTime()).toBeCloseTo(
      startAt.getTime() + result.durationMin * 60_000,
      -4,
    );
    expect(result.warnings).toEqual([]);
  });

  it("returns no cost or end time without a tariff or start time", () => {
    const result = estimateCharge(base);
    expect(result.cost).toBeNull();
    expect(result.endsAt).toBeNull();
  });

  it("produces a monotonic chart curve from start to target", () => {
    const { curve, durationMin } = estimateCharge(base);
    expect(curve[0]).toMatchObject({ minute: 0, socPct: 20 });
    expect(curve.at(-1)).toMatchObject({ socPct: 80 });
    expect(curve.at(-1)?.minute).toBeCloseTo(durationMin, 0);
    expect(curve).toHaveLength(61);
    const minutes = curve.map((point) => point.minute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(new Set(minutes).size).toBe(minutes.length);
  });

  it("handles fractional SoC with partial first and last steps", () => {
    const whole = estimateCharge({ ...base, startSocPct: 20, targetSocPct: 21 });
    const half = estimateCharge({ ...base, startSocPct: 20.5, targetSocPct: 21 });
    const split = estimateCharge({ ...base, startSocPct: 20.25, targetSocPct: 20.75 });

    // durationMin is rounded to 0.1 min.
    expect(Math.abs(half.durationMin - whole.durationMin / 2)).toBeLessThanOrEqual(0.1);
    expect(split.curve.map((p) => p.socPct)).toEqual([20.25, 20.75]);
  });

  it("tapers AC charging above 95 %", () => {
    const below = estimateCharge({ ...base, startSocPct: 90, targetSocPct: 95 });
    const above = estimateCharge({ ...base, startSocPct: 95, targetSocPct: 100 });
    expect(above.durationMin).toBeCloseTo(below.durationMin * 2, 0);
  });

  it("uses the lower efficiency at 110–120 V and warns about high amperage", () => {
    const result = estimateCharge({
      ...base,
      charger: { current: "AC", voltageV: 120, currentA: 20, phases: 1 },
    });
    expect(result.efficiency).toBe(0.85);
    expect(result.warnings).toEqual(["onboard_charger_unknown", "low_voltage_high_amperage"]);
  });

  it("accepts a custom charger efficiency", () => {
    const result = estimateCharge({ ...base, charger: { ...ac220, efficiency: 0.8 } as never });
    expect(result.efficiency).toBe(0.8);
  });

  it("follows the vehicle DC curve when available", () => {
    const vehicle = {
      ...DEEPAL_S05,
      dcMaxKw: 100,
      chargeCurve: [
        { soc: 80, kw: 40 },
        { soc: 0, kw: 80 },
        { soc: 100, kw: 10 },
      ],
    };
    const result = estimateCharge({
      ...base,
      vehicle,
      charger: { current: "DC", ratedKw: 60 },
      startSocPct: 10,
      targetSocPct: 90,
    });

    expect(result.limitedBy).toBe("charger");
    expect(result.warnings).toEqual([]);
    // Charger-limited at 60 kW until the curve drops below it (soc 40), then follows the curve.
    expect(result.curve.find((p) => p.socPct === 20)?.powerKw).toBe(60);
    expect(result.curve.find((p) => p.socPct === 60)?.powerKw).toBe(50);
    expect(result.curve.find((p) => p.socPct === 90)?.powerKw).toBe(25);
  });

  it("warns when the vehicle DC maximum is unknown", () => {
    const result = estimateCharge({ ...base, charger: { current: "DC", ratedKw: 50 } });
    expect(result.warnings).toEqual(["vehicle_dc_max_unknown"]);
  });

  it("scales the capacity by battery health", () => {
    const healthy = estimateCharge(base);
    const worn = estimateCharge({ ...base, vehicle: { ...DEEPAL_S05, batteryHealthPct: 90 } });
    expect(worn.batteryKwh).toBeCloseTo(healthy.batteryKwh * 0.9, 3);
  });

  it("estimates range gained only when consumption is known", () => {
    expect(estimateCharge(base).rangeGainedKm).toBeGreaterThan(200);
    expect(estimateCharge({ ...base, vehicle: { usableKwh: 56.12 } }).rangeGainedKm).toBeNull();
  });

  it("accepts constant overrides", () => {
    const result = estimateCharge(base, {
      chargingEfficiency: { acLowVoltage: 0.85, ac: 1, dc: 0.93 },
    });
    expect(result.gridKwh).toBe(result.batteryKwh);
  });

  it.each([
    ["startSocPct", { startSocPct: -1 }],
    ["targetSocPct", { targetSocPct: 101 }],
    ["targetSocPct", { startSocPct: 50, targetSocPct: 50 }],
    ["tariffPerKwh", { tariffPerKwh: -5 }],
    ["vehicle.usableKwh", { vehicle: { usableKwh: 0 } }],
    ["vehicle.batteryHealthPct", { vehicle: { ...DEEPAL_S05, batteryHealthPct: 0 } }],
    ["vehicle.acOnboardKw", { vehicle: { ...DEEPAL_S05, acOnboardKw: 0 } }],
    ["vehicle.dcMaxKw", { vehicle: { ...DEEPAL_S05, dcMaxKw: -1 } }],
    ["charger.voltageV", { charger: { ...ac220, voltageV: 50 } }],
    ["charger.currentA", { charger: { ...ac220, currentA: 0 } }],
    ["charger.phases", { charger: { ...ac220, phases: 2 } }],
    ["charger.ratedKw", { charger: { ...ac220, ratedKw: 0 } }],
    ["charger.efficiency", { charger: { ...ac220, efficiency: 1.5 } }],
    ["charger.ratedKw", { charger: { current: "DC", ratedKw: 0 } }],
    [
      "vehicle.chargeCurve",
      {
        vehicle: { ...DEEPAL_S05, chargeCurve: [{ soc: 120, kw: 5 }] },
        charger: { current: "DC", ratedKw: 50 },
      },
    ],
  ])("rejects an invalid %s", (field, patch) => {
    const run = () => estimateCharge({ ...base, ...(patch as Partial<ChargeInput>) });
    expect(run).toThrow(CalcInputError);
    expect(run).toThrow(expect.objectContaining({ field }));
  });
});

describe("homeChargerPower", () => {
  it("takes the lowest of circuit, charger and on-board charger", () => {
    expect(homeChargerPower({ voltageV: 220, currentA: 32, phases: 1, ratedKw: 7.4 })).toEqual({
      kw: 7.04,
      limitedBy: "circuit",
      warnings: [],
    });
    expect(
      homeChargerPower({ voltageV: 220, currentA: 32, phases: 1, ratedKw: 7.4, onboardKw: 6.6 }),
    ).toMatchObject({ kw: 6.6, limitedBy: "onboard_charger" });
  });

  it("warns about unusual amperage", () => {
    expect(homeChargerPower({ voltageV: 110, currentA: 20, phases: 1 }).warnings).toEqual([
      "low_voltage_high_amperage",
    ]);
    expect(
      homeChargerPower({ voltageV: 220, currentA: 40, phases: 1, maxAmperageA: 32 }).warnings,
    ).toEqual(["amperage_above_charger_max"]);
  });

  it.each([
    ["voltageV", { voltageV: 50 }],
    ["currentA", { currentA: 0 }],
    ["ratedKw", { ratedKw: 0 }],
  ])("rejects an invalid %s", (field, patch) => {
    const run = () => homeChargerPower({ voltageV: 220, currentA: 16, phases: 1, ...patch });
    expect(run).toThrow(expect.objectContaining({ field }));
  });
});

describe("splitDuration", () => {
  it.each([
    [0, { hours: 0, minutes: 0 }],
    [59.6, { hours: 1, minutes: 0 }],
    [340, { hours: 5, minutes: 40 }],
  ])("splits %d minutes", (minutes, expected) => {
    expect(splitDuration(minutes)).toEqual(expected);
  });

  it("rejects negative durations", () => {
    expect(() => splitDuration(-1)).toThrow(CalcInputError);
  });
});
