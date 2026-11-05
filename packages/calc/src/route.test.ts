import { describe, expect, it } from "vitest";
import { CalcInputError } from "./errors";
import { type RoutePoint, estimatedCurbWeightKg, haversineKm, segmentsFromProfile } from "./route";

// A straight line north along a meridian: 0.009° latitude ≈ 1 km.
const line = (elevations: number[]): RoutePoint[] =>
  elevations.map((e, i) => [-74, 4 + i * 0.009, e]);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("haversineKm", () => {
  it("measures about 1 km per 0.009° of latitude", () => {
    expect(haversineKm([-74, 4, 0], [-74, 4.009, 0])).toBeCloseTo(1.0, 2);
  });
});

describe("segmentsFromProfile", () => {
  const totals = { distanceKm: 20, durationMin: 30, ascentM: 100, descentM: 50 };

  it("splits into chunks whose sums match the router totals", () => {
    // 20 km: climb 100 m in the first half, descend 50 m in the second.
    const elevations = Array.from({ length: 21 }, (_, i) =>
      i <= 10 ? i * 10 : 100 - (i - 10) * 5,
    );
    const segments = segmentsFromProfile(line(elevations), totals, 10);

    expect(segments).toHaveLength(2);
    expect(sum(segments.map((s) => s.distanceKm))).toBeCloseTo(20, 6);
    expect(sum(segments.map((s) => s.durationMin))).toBeCloseTo(30, 6);
    expect(segments[0]).toMatchObject({ ascentM: 100, descentM: 0 });
    expect(segments[1]).toMatchObject({ ascentM: 0, descentM: 50 });
  });

  it("ignores elevation noise below the threshold and spreads totals by distance", () => {
    const segments = segmentsFromProfile(
      line([100, 101, 99, 100, 102]),
      { ...totals, distanceKm: 4 },
      2,
    );
    expect(segments).toHaveLength(2);
    expect(segments.map((s) => s.ascentM)).toEqual([50, 50]);
  });

  it("falls back to one segment without a usable profile", () => {
    expect(segmentsFromProfile([], totals)).toEqual([totals]);
    expect(
      segmentsFromProfile(
        line([5, 5]).map((p) => [p[0], 4, p[2]] as const),
        totals,
      ),
    ).toEqual([totals]);
  });

  it("validates its inputs", () => {
    expect(() => segmentsFromProfile([], { ...totals, distanceKm: -1 })).toThrow(CalcInputError);
    expect(() => segmentsFromProfile([], totals, 0)).toThrow(CalcInputError);
  });
});

describe("estimatedCurbWeightKg", () => {
  it("lands near real weights", () => {
    expect(estimatedCurbWeightKg(56.12)).toBe(1849);
    expect(() => estimatedCurbWeightKg(0)).toThrow(CalcInputError);
  });
});
