import type { CurveStep } from "./constants";
import { CalcInputError } from "./errors";

/** A vehicle charge curve point: the battery accepts at most `kw` at `soc` %. */
export interface ChargeCurvePoint {
  soc: number;
  kw: number;
}

/** Fraction of the available power for `socPct`, from a piecewise default curve. */
export function stepFraction(steps: readonly CurveStep[], socPct: number): number {
  const step = steps.find((s) => socPct < s.belowSoc);
  return step ? step.fraction : 1;
}

/** Sorts and validates a vehicle curve (same rules as the database CHECK). */
export function normalizeCurve(curve: readonly ChargeCurvePoint[]): ChargeCurvePoint[] {
  if (curve.length === 0)
    throw new CalcInputError("vehicle.chargeCurve", "The charge curve is empty.");
  for (const point of curve) {
    if (!(point.soc >= 0 && point.soc <= 100) || !(point.kw > 0)) {
      throw new CalcInputError(
        "vehicle.chargeCurve",
        "Each charge curve point needs soc within 0..100 and kw > 0.",
      );
    }
  }
  return [...curve].sort((a, b) => a.soc - b.soc);
}

/** Linear interpolation of a sorted curve; flat beyond its first and last points. */
export function curvePowerKw(curve: readonly ChargeCurvePoint[], socPct: number): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last)
    throw new CalcInputError("vehicle.chargeCurve", "The charge curve is empty.");
  if (socPct <= first.soc) return first.kw;
  if (socPct >= last.soc) return last.kw;
  for (let i = 1; i < curve.length; i++) {
    const right = curve[i];
    const left = curve[i - 1];
    if (right && left && socPct <= right.soc) {
      const t = (socPct - left.soc) / (right.soc - left.soc);
      return left.kw + t * (right.kw - left.kw);
    }
  }
  /* c8 ignore next */
  return last.kw;
}
