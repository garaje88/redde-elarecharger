import { type CalcConstants, type RangeCycle, resolveConstants } from "./constants";
import { CalcInputError, assertPositive } from "./errors";

export interface ConsumptionSource {
  /** Known real-world consumption; when given, it wins over the homologated range. */
  consumptionKwh100km?: number | null;
  usableKwh: number;
  rangeKm?: number | null;
  rangeCycle?: RangeCycle | null;
}

/**
 * Base consumption in kWh/100 km. Without a known value it is derived from the homologated
 * range: usable ÷ range × 100 × cycle factor (Deepal S05: 56.12 ÷ 458 × 100 × 1.30 ≈ 15.9).
 */
export function baseConsumptionKwh100km(
  source: ConsumptionSource,
  overrides?: Partial<CalcConstants>,
): number {
  if (source.consumptionKwh100km != null) {
    assertPositive("consumptionKwh100km", source.consumptionKwh100km);
    return source.consumptionKwh100km;
  }
  if (source.rangeKm == null || source.rangeCycle == null) {
    throw new CalcInputError(
      "consumptionKwh100km",
      "Base consumption is unknown: provide it or the homologated range and its cycle.",
    );
  }
  assertPositive("usableKwh", source.usableKwh);
  assertPositive("rangeKm", source.rangeKm);
  const { cycleFactors } = resolveConstants(overrides);
  return (source.usableKwh / source.rangeKm) * 100 * cycleFactors[source.rangeCycle];
}
