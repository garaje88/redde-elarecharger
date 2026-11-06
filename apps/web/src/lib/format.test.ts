import { describe, expect, it } from "vitest";
import { formatKw, formatNumber, formatSourceDate, parseColombianDecimal } from "./format";

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

describe("parseColombianDecimal", () => {
  it("reads comma decimals and dot thousands", () => {
    expect(parseColombianDecimal("912,35")).toEqual({ value: 912.35 });
    expect(parseColombianDecimal(" 1.234,5 ")).toEqual({ value: 1234.5 });
    expect(parseColombianDecimal("900")).toEqual({ value: 900 });
    expect(parseColombianDecimal("")).toEqual({ value: null });
  });

  it("rejects a dot used as the decimal mark and anything that is not a number", () => {
    expect(parseColombianDecimal("912.35")).toEqual({
      error: "Usa coma para los decimales, por ejemplo 912,35.",
    });
    expect(parseColombianDecimal("12,345")).toHaveProperty("error");
    expect(parseColombianDecimal("-5")).toHaveProperty("error");
    expect(parseColombianDecimal("abc")).toHaveProperty("error");
  });
});
