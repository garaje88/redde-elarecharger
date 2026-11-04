import { describe, expect, it } from "vitest";
import { CalcInputError } from "./errors";
import { DEEPAL_S05 } from "./test/fixtures";
import { type TripInput, estimateTrip } from "./trip";

const segment = { distanceKm: 100, durationMin: 90, ascentM: 0, descentM: 0 };
const base: TripInput = { vehicle: DEEPAL_S05, segments: [segment], startSocPct: 80 };

describe("estimateTrip", () => {
  it("applies the speed bands per segment", () => {
    const speeds = [
      [40, 0.9],
      [65, 1],
      [90, 1.12],
      [120, 1.25],
    ] as const;
    for (const [kmh, factor] of speeds) {
      const result = estimateTrip({
        ...base,
        segments: [{ ...segment, durationMin: (100 / kmh) * 60 }],
      });
      expect(result.segments[0]?.speedFactor).toBe(factor);
    }
  });

  it("uses a neutral speed factor when the duration is unknown", () => {
    const result = estimateTrip({ ...base, segments: [{ ...segment, durationMin: 0 }] });
    expect(result.segments[0]).toMatchObject({ averageSpeedKmh: null, speedFactor: 1 });
  });

  it("sums segments, so splitting a route does not change a uniform result", () => {
    const whole = estimateTrip(base);
    const half = { distanceKm: 50, durationMin: 45, ascentM: 0, descentM: 0 };
    const split = estimateTrip({ ...base, segments: [half, half] });
    expect(split.energyKwh).toBeCloseTo(whole.energyKwh, 3);
    expect(split.breakdown.distanceKm).toBe(100);
  });

  it("applies style, A/C and climate factors", () => {
    const plain = estimateTrip(base).energyKwh;
    expect(estimateTrip({ ...base, style: "eco" }).energyKwh).toBeCloseTo(plain * 0.92, 2);
    expect(estimateTrip({ ...base, style: "sport" }).energyKwh).toBeCloseTo(plain * 1.15, 2);
    expect(estimateTrip({ ...base, airConditioning: true }).energyKwh).toBeCloseTo(plain * 1.06, 2);
    expect(estimateTrip({ ...base, outsideTempC: 20 }).breakdown.climateFactor).toBe(1);
    expect(estimateTrip({ ...base, outsideTempC: 10 }).breakdown.climateFactor).toBe(1.08);
    expect(estimateTrip({ ...base, outsideTempC: 0 }).breakdown.climateFactor).toBe(1.2);
    expect(estimateTrip({ ...base, outsideTempC: 32 }).breakdown.climateFactor).toBe(1);
  });

  it("recovers part of the descent with regeneration", () => {
    const down = estimateTrip({ ...base, segments: [{ ...segment, descentM: 1000 }] });
    const mass = DEEPAL_S05.curbWeightKg + 75;
    expect(down.breakdown.regenKwh).toBeCloseTo((mass * 9.81 * 1000 * 0.6) / 3.6e6, 3);
    expect(down.energyKwh).toBeLessThan(estimateTrip(base).energyKwh);
  });

  it("never arrives above 100 % on a long descent", () => {
    const result = estimateTrip({
      ...base,
      startSocPct: 99,
      segments: [{ distanceKm: 10, durationMin: 15, ascentM: 0, descentM: 2500 }],
    });
    expect(result.energyKwh).toBeLessThan(0);
    expect(result.arrivalSocPct).toBe(100);
  });

  it("adds passengers and cargo to the mass", () => {
    const result = estimateTrip({ ...base, passengers: 4, cargoKg: 50 });
    expect(result.breakdown.massKg).toBe(DEEPAL_S05.curbWeightKg + 4 * 75 + 50);
  });

  it("flags unreachable destinations and the reserve", () => {
    const short = estimateTrip({ ...base, startSocPct: 40 });
    expect(short).toMatchObject({ reachable: true, belowReserve: false, reservePct: 10 });

    const tight = estimateTrip({ ...base, startSocPct: 35 });
    expect(tight).toMatchObject({ reachable: true, belowReserve: true });

    const far = estimateTrip({ ...base, startSocPct: 20 });
    expect(far.reachable).toBe(false);
    expect(far.arrivalSocPct).toBeLessThan(0);
    expect(far.remainingRangeKm).toBe(0);

    expect(estimateTrip({ ...base, startSocPct: 40, reservePct: 15 }).belowReserve).toBe(true);
  });

  it("reports a ±10 % margin around the estimate", () => {
    const result = estimateTrip(base);
    expect(result.energyRangeKwh.min).toBeCloseTo(result.energyKwh * 0.9, 2);
    expect(result.energyRangeKwh.max).toBeCloseTo(result.energyKwh * 1.1, 2);
    expect(result.arrivalSocRangePct.min).toBeLessThan(result.arrivalSocPct);
    expect(result.arrivalSocRangePct.max).toBeGreaterThan(result.arrivalSocPct);
  });

  it("estimates the remaining range at the trip's driving conditions", () => {
    const result = estimateTrip({ ...base, startSocPct: 100 });
    const kwhPerKm = result.breakdown.baseConsumptionKwh100km / 100;
    expect(result.remainingRangeKm).toBeCloseTo(
      ((result.arrivalSocPct / 100) * 56.12) / kwhPerKm,
      0,
    );
  });

  it("prefers a known consumption and scales capacity by battery health", () => {
    const result = estimateTrip({
      ...base,
      vehicle: { ...DEEPAL_S05, consumptionKwh100km: 18, batteryHealthPct: 90 },
    });
    expect(result.breakdown.baseConsumptionKwh100km).toBe(18);
    expect(result.breakdown.usableKwh).toBeCloseTo(50.508, 3);
  });

  it("accepts constant overrides", () => {
    const result = estimateTrip(base, { styleFactors: { eco: 1, normal: 2, sport: 3 } });
    expect(result.breakdown.styleFactor).toBe(2);
  });

  it.each([
    ["segments", { segments: [] }],
    ["startSocPct", { startSocPct: 120 }],
    ["passengers", { passengers: 12 }],
    ["cargoKg", { cargoKg: -1 }],
    ["outsideTempC", { outsideTempC: 80 }],
    ["reservePct", { reservePct: 60 }],
    ["vehicle.usableKwh", { vehicle: { ...DEEPAL_S05, usableKwh: 0 } }],
    ["vehicle.curbWeightKg", { vehicle: { ...DEEPAL_S05, curbWeightKg: 0 } }],
    ["vehicle.batteryHealthPct", { vehicle: { ...DEEPAL_S05, batteryHealthPct: 101 } }],
    ["segments.0.distanceKm", { segments: [{ ...segment, distanceKm: -1 }] }],
    ["segments.0.durationMin", { segments: [{ ...segment, durationMin: Number.NaN }] }],
    ["segments.0.ascentM", { segments: [{ ...segment, ascentM: -5 }] }],
    ["segments.0.descentM", { segments: [{ ...segment, descentM: -5 }] }],
  ])("rejects an invalid %s", (field, patch) => {
    const run = () => estimateTrip({ ...base, ...(patch as Partial<TripInput>) });
    expect(run).toThrow(CalcInputError);
    expect(run).toThrow(expect.objectContaining({ field }));
  });
});
