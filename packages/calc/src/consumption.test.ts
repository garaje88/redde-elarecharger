import { describe, expect, it } from "vitest";
import { baseConsumptionKwh100km } from "./consumption";
import { CalcInputError } from "./errors";

describe("baseConsumptionKwh100km", () => {
  it.each([
    ["NEDC", 1.3],
    ["WLTP", 1.15],
    ["EPA", 1.0],
    ["CLTC", 1.35],
  ] as const)("derives it from a %s range", (cycle, factor) => {
    expect(baseConsumptionKwh100km({ usableKwh: 50, rangeKm: 400, rangeCycle: cycle })).toBeCloseTo(
      12.5 * factor,
      6,
    );
  });

  it("matches the Deepal S05 example (≈ 15.9 kWh/100 km)", () => {
    expect(
      baseConsumptionKwh100km({ usableKwh: 56.12, rangeKm: 458, rangeCycle: "NEDC" }),
    ).toBeCloseTo(15.93, 2);
  });

  it("prefers a known consumption", () => {
    expect(
      baseConsumptionKwh100km({
        usableKwh: 50,
        consumptionKwh100km: 17,
        rangeKm: 400,
        rangeCycle: "EPA",
      }),
    ).toBe(17);
  });

  it("accepts calibrated cycle factors", () => {
    expect(
      baseConsumptionKwh100km(
        { usableKwh: 50, rangeKm: 400, rangeCycle: "CLTC" },
        { cycleFactors: { NEDC: 1.3, WLTP: 1.15, EPA: 1, CLTC: 1.4 } },
      ),
    ).toBeCloseTo(17.5, 6);
  });

  it.each([
    [{ usableKwh: 50 }, "consumptionKwh100km"],
    [{ usableKwh: 50, rangeKm: 400 }, "consumptionKwh100km"],
    [{ usableKwh: 50, consumptionKwh100km: 0 }, "consumptionKwh100km"],
    [{ usableKwh: 50, rangeKm: 0, rangeCycle: "EPA" as const }, "rangeKm"],
    [{ usableKwh: -1, rangeKm: 400, rangeCycle: "EPA" as const }, "usableKwh"],
  ])("rejects %o", (source, field) => {
    expect(() => baseConsumptionKwh100km(source)).toThrow(expect.objectContaining({ field }));
    expect(() => baseConsumptionKwh100km(source)).toThrow(CalcInputError);
  });
});
