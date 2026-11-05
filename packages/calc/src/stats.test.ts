import { describe, expect, it } from "vitest";
import { CalcInputError } from "./errors";
import { type SessionRecord, monthKey, sessionStats } from "./stats";

// Seed data: four home charges of a 56.12 kWh car in October 2026 and one in September.
// Odometer: 10 000 → 10 210 → 10 420 → 10 640 → 10 845 km.
const at = (iso: string) => new Date(iso);
const SEED: SessionRecord[] = [
  {
    startedAt: at("2026-09-28T23:00:00Z"),
    energyKwh: 30,
    cost: 27_000,
    odometerKm: 10_000,
    startSocPct: 30,
    endSocPct: 80,
  },
  {
    startedAt: at("2026-10-05T23:00:00Z"),
    energyKwh: 37.4,
    cost: 33_660,
    odometerKm: 10_210,
    startSocPct: 20,
    endSocPct: 80,
  },
  {
    startedAt: at("2026-10-12T23:00:00Z"),
    energyKwh: 36.2,
    cost: 32_580,
    odometerKm: 10_420,
    startSocPct: 18,
    endSocPct: 80,
  },
  {
    startedAt: at("2026-10-20T23:00:00Z"),
    energyKwh: 37.0,
    cost: 33_300,
    odometerKm: 10_640,
    startSocPct: 15,
    endSocPct: 80,
  },
  // Logged on Nov 1st 03:00 UTC, still October 31st in Colombia.
  {
    startedAt: at("2026-11-01T03:00:00Z"),
    energyKwh: 31.4,
    cost: 28_260,
    odometerKm: 10_845,
    startSocPct: 22,
    endSocPct: 80,
  },
];

describe("monthKey", () => {
  it("uses Colombian time", () => {
    expect(monthKey(at("2026-11-01T03:00:00Z"))).toBe("2026-10");
    expect(monthKey(at("2026-11-01T06:00:00Z"))).toBe("2026-11");
    expect(monthKey(at("2026-11-01T03:00:00Z"), 0)).toBe("2026-11");
  });
});

describe("sessionStats", () => {
  const stats = sessionStats(SEED, { usableKwh: 56.12, month: "2026-10" });

  it("measures real consumption from the SoC drop between charges", () => {
    // Used: (80−20)+(80−18)+(80−15)+(80−22) = 245 % of 56.12 kWh = 137.494 kWh over 845 km.
    expect(stats.realConsumptionKwh100km).toBe(16.3);
    expect(stats.avgKmBetweenCharges).toBe(211);
  });

  it("computes cost per km from the cost of each next charge", () => {
    // (33 660 + 32 580 + 33 300 + 28 260) / 845 km = 151.2 COP/km.
    expect(stats.costPerKm).toBe(151.2);
  });

  it("summarizes the month", () => {
    expect(stats).toMatchObject({
      monthSessions: 4,
      monthEnergyKwh: 142,
      monthCost: 127_800,
      monthKm: 845,
    });
  });

  it("charts the last six months", () => {
    expect(stats.monthly.map((m) => m.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(stats.monthly.at(-2)).toEqual({
      month: "2026-09",
      energyKwh: 30,
      cost: 27_000,
      sessions: 1,
    });
  });

  it("falls back to charged kWh without SoC readings or battery size", () => {
    const grid = sessionStats(SEED, { month: "2026-10" });
    // (37.4 + 36.2 + 37.0 + 31.4) / 845 km = 16.8 kWh/100 km (grid side).
    expect(grid.realConsumptionKwh100km).toBe(16.8);
  });

  it("needs two odometer readings and skips non-increasing ones", () => {
    const one = sessionStats([SEED[1] as SessionRecord], { month: "2026-10" });
    expect(one).toMatchObject({
      realConsumptionKwh100km: null,
      costPerKm: null,
      avgKmBetweenCharges: null,
      monthKm: null,
    });
    const rollback = sessionStats(
      [
        { startedAt: at("2026-10-01T12:00:00Z"), odometerKm: 500, energyKwh: 10 },
        { startedAt: at("2026-10-02T12:00:00Z"), odometerKm: 400, energyKwh: 10 },
        { startedAt: at("2026-10-03T12:00:00Z"), odometerKm: 600 },
      ],
      { month: "2026-10", months: 1 },
    );
    expect(rollback).toMatchObject({
      avgKmBetweenCharges: 200,
      realConsumptionKwh100km: null,
      monthly: [{ sessions: 3, energyKwh: 20 }],
    });
  });

  it("rejects negative values", () => {
    expect(() =>
      sessionStats([{ startedAt: new Date(), energyKwh: -1 }], { month: "2026-10" }),
    ).toThrow(CalcInputError);
    expect(() => sessionStats([{ startedAt: new Date(), cost: -1 }], { month: "2026-10" })).toThrow(
      CalcInputError,
    );
    expect(() =>
      sessionStats([{ startedAt: new Date(), odometerKm: -1 }], { month: "2026-10" }),
    ).toThrow(CalcInputError);
  });
});
