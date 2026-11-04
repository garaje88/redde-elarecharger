import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, bandFactor, resolveConstants } from "./constants";
import { curvePowerKw, normalizeCurve, stepFraction } from "./curves";
import { CalcInputError } from "./errors";

describe("curvePowerKw", () => {
  const curve = normalizeCurve([
    { soc: 50, kw: 60 },
    { soc: 10, kw: 100 },
    { soc: 90, kw: 20 },
  ]);

  it("sorts points by SoC", () => {
    expect(curve.map((p) => p.soc)).toEqual([10, 50, 90]);
  });

  it("interpolates linearly and stays flat outside the range", () => {
    expect(curvePowerKw(curve, 0)).toBe(100);
    expect(curvePowerKw(curve, 30)).toBe(80);
    expect(curvePowerKw(curve, 70)).toBe(40);
    expect(curvePowerKw(curve, 95)).toBe(20);
  });

  it("rejects empty or invalid curves", () => {
    expect(() => normalizeCurve([])).toThrow(CalcInputError);
    expect(() => normalizeCurve([{ soc: 50, kw: 0 }])).toThrow(CalcInputError);
    expect(() => curvePowerKw([], 50)).toThrow(CalcInputError);
  });
});

describe("stepFraction and bandFactor", () => {
  it("default DC curve: 100 % below 80, 60 % to 90, 35 % after", () => {
    const dc = DEFAULT_CONSTANTS.defaultCurves.dc;
    expect([79, 80, 89, 90, 99].map((s) => stepFraction(dc, s))).toEqual([1, 0.6, 0.6, 0.35, 0.35]);
  });

  it("falls back to 1 when no band matches", () => {
    expect(stepFraction([{ belowSoc: 50, fraction: 0.5 }], 70)).toBe(1);
    expect(bandFactor([{ below: 10, factor: 2 }], 20)).toBe(1);
  });
});

describe("resolveConstants", () => {
  it("merges nested overrides without losing defaults", () => {
    const k = resolveConstants({
      cycleFactors: { ...DEFAULT_CONSTANTS.cycleFactors, CLTC: 1.4 },
      uncertainty: 0.2,
    });
    expect(k.cycleFactors).toMatchObject({ NEDC: 1.3, CLTC: 1.4 });
    expect(k.uncertainty).toBe(0.2);
    expect(k.styleFactors).toEqual(DEFAULT_CONSTANTS.styleFactors);
  });
});
