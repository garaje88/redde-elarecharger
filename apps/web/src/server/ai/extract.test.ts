import { describe, expect, it } from "vitest";
import { sniffMediaType, toReceiptDraft, toVehicleDraft } from "./extract";

const f = (value: unknown, confidence = 0.9) => ({ value, confidence });

const receipt = {
  found: true,
  energy_kwh: f(32.4),
  cost: f(45600),
  currency: f("cop"),
  start_soc: f(22),
  end_soc: f(80),
  date: f("2026-11-03"),
  start_time: f("21:40"),
  end_time: f("01:15", 0.6),
  odometer_km: f(12850),
  location_label: f("Terpel Voltex, Bogotá"),
};

describe("toReceiptDraft", () => {
  it("turns local Colombian times into ISO and crosses midnight", () => {
    const result = toReceiptDraft(receipt);
    expect(result?.draft).toEqual({
      energy_kwh: 32.4,
      cost: 45600,
      currency: "COP",
      start_soc: 22,
      end_soc: 80,
      started_at: "2026-11-04T02:40:00Z",
      ended_at: "2026-11-04T06:15:00Z",
      odometer_km: 12850,
      location_label: "Terpel Voltex, Bogotá",
    });
    expect(result?.confidence.ended_at).toBe(0.6);
  });

  it("drops values outside the session limits and zeroes their confidence", () => {
    const result = toReceiptDraft({
      ...receipt,
      start_soc: f(130),
      end_soc: f(10),
      energy_kwh: f(-5),
      date: f("2026-02-31"),
    });
    expect(result?.draft).toMatchObject({
      start_soc: null,
      end_soc: 10,
      energy_kwh: null,
      started_at: null,
      ended_at: null,
    });
    expect(result?.confidence).toMatchObject({ start_soc: 0, energy_kwh: 0, started_at: 0 });
  });

  it("rejects a final charge that is not above the initial one", () => {
    expect(toReceiptDraft({ ...receipt, end_soc: f(20) })?.draft.end_soc).toBeNull();
  });

  it("returns nothing when the photo shows no charge or the model refused", () => {
    expect(toReceiptDraft({ ...receipt, found: false })).toBeNull();
    expect(toReceiptDraft(null)).toBeNull();
  });

  it("clamps confidence to 0..1", () => {
    expect(toReceiptDraft({ ...receipt, cost: f(1000, 7) })?.confidence.cost).toBe(1);
  });
});

describe("toVehicleDraft", () => {
  it("validates the sheet like the web lookup and keeps no source URLs", () => {
    const result = toVehicleDraft({
      found: true,
      brand: "Deepal",
      model: "S05",
      trim: "",
      year_from: f(2025),
      year_to: f(null),
      battery_gross_kwh: f(56.12),
      battery_usable_kwh: f(60),
      chemistry: f("LFP"),
      range_km: f(458),
      range_cycle: f("NEDC"),
      consumption_kwh_100km: f(null),
      curb_weight_kg: f(1800),
      ac_onboard_kw: f(null),
      ac_phases: f(null),
      dc_max_kw: f(null),
      connector_ac: f("TYPE2"),
      connector_dc: f("CCS2"),
    });
    // Usable above gross fails the shared schema: that field is emptied, the rest kept.
    expect(result?.spec).toMatchObject({
      brand: "Deepal",
      battery_gross_kwh: 56.12,
      battery_usable_kwh: null,
      range_km: 458,
    });
    expect(result?.confidence.battery_usable_kwh).toBe(0);
    expect(result?.fieldUrls).toEqual({});
  });
});

describe("sniffMediaType", () => {
  const bytes = (...values: (number | string)[]) =>
    new Uint8Array(
      values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
    );

  it("recognizes the real type from the first bytes", () => {
    expect(sniffMediaType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMediaType(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("image/png");
    expect(sniffMediaType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
  });

  it("rejects anything else, whatever its name says", () => {
    expect(sniffMediaType(bytes("<html>"))).toBeNull();
    expect(sniffMediaType(bytes("GIF89a"))).toBeNull();
  });
});
