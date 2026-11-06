import { describe, expect, it } from "vitest";
import { __test } from "./spec-lookup";

const f = (
  value: unknown,
  confidence = 0.9,
  source_url: string | null = "https://maker.example/sheet",
) => ({
  value,
  confidence,
  source_url,
});

const vehicle = {
  found: true,
  brand: "Deepal",
  model: "S07",
  trim: "",
  year_from: f(2025),
  year_to: f(null),
  battery_gross_kwh: f(null),
  battery_usable_kwh: f(66.8),
  chemistry: f("LFP"),
  range_km: f(485),
  range_cycle: f("NEDC"),
  consumption_kwh_100km: f(null),
  curb_weight_kg: f(1980, 1.4, "not a url"),
  ac_onboard_kw: f(6.6),
  ac_phases: f(2),
  dc_max_kw: f(null),
  connector_ac: f("TYPE2"),
  connector_dc: f("CCS2"),
};

describe("toResult", () => {
  it("keeps valid fields, clamps confidence and nulls invalid ones", () => {
    const result = __test.toResult("vehicle", vehicle, [
      { title: "Ficha", url: "https://maker.example/sheet" },
    ]);

    expect(result?.spec).toMatchObject({
      brand: "Deepal",
      model: "S07",
      battery_usable_kwh: 66.8,
      ac_phases: null,
    });
    expect(result?.confidence).toMatchObject({ curb_weight_kg: 1, ac_phases: 0 });
    expect(result?.fieldUrls).toEqual(
      expect.not.objectContaining({
        curb_weight_kg: expect.anything(),
        ac_phases: expect.anything(),
      }),
    );
    expect(result?.fieldUrls.battery_usable_kwh).toBe("https://maker.example/sheet");
  });

  it("keeps an unsure web lookup that still read enough values", () => {
    const unsure = { ...vehicle, found: false };
    expect(__test.toResult("vehicle", unsure, [], { minValuesWhenUnsure: 3 })?.spec).toMatchObject({
      brand: "Deepal",
      battery_usable_kwh: 66.8,
    });
    expect(__test.toResult("vehicle", unsure, [], { minValuesWhenUnsure: 50 })).toBeNull();
    expect(__test.toResult("vehicle", { ...vehicle, model: "" }, [])).toBeNull();
  });

  it("uses the year the user typed when the sheet gives none, or asks for it", () => {
    const noYear = { ...vehicle, year_from: f(null) };
    const typed = __test.toResult("vehicle", noYear, [], { fallbackYear: 2025 });
    expect(typed?.spec).toMatchObject({ year_from: 2025 });
    expect(typed?.confidence.year_from).toBe(0.6);
    const unknown = __test.toResult("vehicle", noYear, []);
    expect(unknown?.confidence.year_from).toBe(0);
  });

  it("returns null when nothing reliable was found", () => {
    expect(__test.toResult("vehicle", { ...vehicle, found: false }, [])).toBeNull();
  });

  it("drops a range whose cycle is missing", () => {
    const result = __test.toResult("vehicle", { ...vehicle, range_cycle: f(null) }, []);
    expect(result?.spec).toMatchObject({ range_km: null, range_cycle: null });
  });

  it("validates chargers", () => {
    const result = __test.toResult(
      "charger",
      {
        found: true,
        brand: "Wallbox",
        model: "Pulsar Plus",
        kind: f("wallbox"),
        rated_kw: f(7.4),
        phases: f(1),
        max_amperage_a: f(32),
        adjustable_amperage: f([6, 32, 900]),
        input_voltage_min: f(200),
        input_voltage_max: f(250),
        connector: f("TYPE2"),
        tethered_cable: f(true),
      },
      [],
    );
    expect(result?.spec).toMatchObject({ rated_kw: 7.4, adjustable_amperage: [] });
  });
});
