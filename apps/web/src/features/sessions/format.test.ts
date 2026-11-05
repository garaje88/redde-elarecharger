import { describe, expect, it } from "vitest";
import { monthShort, monthTitle, sessionDay, sessionSummary, shiftMonth } from "./format";

describe("session formatting", () => {
  it("names months and days in Spanish, Colombian time", () => {
    expect(monthTitle("2026-10")).toBe("Octubre 2026");
    expect(monthShort("2026-05")).toBe("may");
    expect(sessionDay("2026-11-01T03:00:00Z")).toBe("31 oct");
  });

  it("moves across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("summarizes SoC and duration", () => {
    expect(
      sessionSummary({
        start_soc: 18,
        end_soc: 85,
        started_at: "2026-10-29T01:00:00Z",
        ended_at: "2026-10-29T07:20:00Z",
      }),
    ).toBe("18 → 85 % · 6 h 20 min");
    expect(
      sessionSummary({
        start_soc: null,
        end_soc: null,
        started_at: "2026-10-29T01:00:00Z",
        ended_at: null,
      }),
    ).toBe("");
  });
});
