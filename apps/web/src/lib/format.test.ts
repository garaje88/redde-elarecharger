import { describe, expect, it } from "vitest";
import { formatKw, formatNumber, formatSourceDate } from "./format";

describe("format", () => {
  it("uses Colombian separators", () => {
    expect(formatNumber(56.12, 2)).toBe("56,12");
    expect(formatNumber(1852)).toBe("1.852");
    expect(formatKw(7.04)).toBe("7 kW");
    expect(formatKw(1.32)).toBe("1,3 kW");
  });

  it("formats source dates and tolerates bad input", () => {
    expect(formatSourceDate("2026-11-04")).toBe("nov 2026");
    expect(formatSourceDate(undefined)).toBeNull();
    expect(formatSourceDate("nope")).toBeNull();
  });
});
