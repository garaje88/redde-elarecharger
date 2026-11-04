import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { mergeVariant } from "./merge";
import { matchEpa, parseEpaCsv, epaSource } from "./sources/epa";
import { matchOcmConnectors } from "./sources/ocm";
import { parseOpenEvData } from "./sources/open-ev-data";
import { clean, normalize, positive, slugify } from "./text";
import type { FieldSource } from "./types";

const curve = [
  { percentage: 0, power: 80.75 },
  { percentage: 50, power: 85 },
  { percentage: 80, power: 42.5 },
  { percentage: 100, power: 17 },
];

const oevd = (overrides: Record<string, unknown>) => ({
  id: "a1",
  brand: "Kia",
  model: "EV3 Long Range",
  variant: "",
  release_year: 2024,
  vehicle_type: "car",
  usable_battery_size: 78,
  ac_charger: { ports: ["type2"], usable_phases: 3, max_power: 11 },
  dc_charger: {
    ports: ["ccs"],
    max_power: 128,
    charging_curve: curve,
    is_default_charging_curve: false,
  },
  energy_consumption: { average_consumption: 16.2 },
  ...overrides,
});

describe("text helpers", () => {
  it("normalizes like the SQL catalog_normalize", () => {
    expect(normalize("Deepal  S-05")).toBe("deepal s05");
    expect(normalize("ID. Buzz")).toBe("id buzz");
  });

  it("slugifies accents and punctuation", () => {
    expect(slugify("Citroën ë-C4 ")).toBe("citroen-e-c4");
    expect(slugify("EV3 Long Range")).toBe("ev3-long-range");
  });

  it("cleans and parses numbers", () => {
    expect(clean("  Seal   U ")).toBe("Seal U");
    expect(clean(42)).toBe("");
    expect(positive("12.5")).toBe(12.5);
    expect(positive(0)).toBeNull();
    expect(positive("x")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    const rows = parseCsv('a,b,c\r\n1,"x, ""y""",3\n\n4,5\n');
    expect(rows).toEqual([
      { a: "1", b: 'x, "y"', c: "3" },
      { a: "4", b: "5", c: "" },
    ]);
  });

  it("returns nothing for empty input and keeps a last line without newline", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("a\n1")).toEqual([{ a: "1" }]);
  });
});

describe("parseOpenEvData", () => {
  it("maps a record to catalog fields", () => {
    const { records, skipped } = parseOpenEvData({ data: [oevd({})] }, "2026-11-04");

    expect(skipped).toEqual([]);
    expect(records[0]).toMatchObject({
      sourceRef: "open-ev-data:a1",
      brand: "Kia",
      model: "EV3 Long Range",
      yearFrom: 2024,
      source: { source: "Open EV Data", retrieved_at: "2026-11-04" },
      fields: {
        battery_usable_kwh: 78,
        battery_gross_kwh: null,
        consumption_kwh_100km: 16.2,
        range_km: null,
        range_cycle: null,
        ac_onboard_kw: 11,
        ac_phases: 3,
        dc_max_kw: 128,
        connector_ac: "TYPE2",
        connector_dc: "CCS2",
        charge_curve: [
          { soc: 0, kw: 80.8 },
          { soc: 50, kw: 85 },
          { soc: 80, kw: 42.5 },
          { soc: 100, kw: 17 },
        ],
      },
    });
  });

  it("derives connectors and keeps WLTP range and gross capacity", () => {
    const { records } = parseOpenEvData(
      {
        data: [
          oevd({
            id: "us",
            ac_charger: { ports: ["type1"], usable_phases: 1, max_power: 7.2 },
            dc_charger: {
              ports: ["ccs"],
              max_power: 50,
              is_default_charging_curve: true,
              charging_curve: curve,
            },
            energy_consumption: { average_consumption: 17, range: 400 },
            battery_size: 82,
          }),
          oevd({
            id: "tesla",
            model: "Model 3",
            dc_charger: { ports: ["tesla_suc"], max_power: 250 },
          }),
          oevd({
            id: "leaf",
            model: "Leaf",
            ac_charger: { ports: [], usable_phases: 2 },
            dc_charger: { ports: ["chademo"], max_power: 50 },
          }),
          oevd({
            id: "none",
            model: "Mystery",
            ac_charger: null,
            dc_charger: { ports: ["other"] },
            battery_size: 10,
          }),
        ],
      },
      "2026-11-04",
    );

    expect(records.map((r) => [r.fields.connector_ac, r.fields.connector_dc])).toEqual([
      ["TYPE1", "CCS1"],
      ["TYPE2", "NACS"],
      [null, "CHADEMO"],
      [null, null],
    ]);
    expect(records[0]?.fields).toMatchObject({
      range_km: 400,
      range_cycle: "WLTP",
      battery_gross_kwh: 82,
      charge_curve: null,
    });
    expect(records[2]?.fields.ac_phases).toBeNull();
    expect(records[3]?.fields).toMatchObject({
      battery_gross_kwh: null,
      ac_onboard_kw: null,
      charge_curve: null,
    });
  });

  it("ignores measured curves with fewer than two valid points", () => {
    const { records } = parseOpenEvData(
      {
        data: [
          oevd({
            dc_charger: {
              ports: ["ccs"],
              max_power: 50,
              is_default_charging_curve: false,
              charging_curve: [
                { percentage: 0, power: 50 },
                { percentage: 120, power: 5 },
              ],
            },
          }),
          oevd({
            id: "b",
            model: "Other",
            dc_charger: { ports: ["ccs"], is_default_charging_curve: false, charging_curve: "n/a" },
          }),
        ],
      },
      "d",
    );
    expect(records.map((r) => r.fields.charge_curve)).toEqual([null, null]);
  });

  it("skips malformed, non-car and duplicate records with a reason", () => {
    const { records, skipped } = parseOpenEvData(
      {
        data: [
          oevd({ id: "" }),
          oevd({ id: "moto", vehicle_type: "motorbike" }),
          oevd({ id: "nobrand", brand: " " }),
          oevd({ id: "garbage", brand: "BYD", model: "44." }),
          oevd({ id: "noyear", release_year: null }),
          oevd({ id: "nobattery", usable_battery_size: 0 }),
          oevd({ id: "first" }),
          oevd({ id: "copy" }),
        ],
      },
      "d",
    );

    expect(records.map((r) => r.sourceRef)).toEqual(["open-ev-data:first"]);
    expect(skipped.map((s) => s.reason)).toEqual([
      "missing id",
      "vehicle type motorbike",
      "missing brand",
      'malformed model name "44."',
      "missing release year",
      "missing usable battery",
      "duplicate of another record",
    ]);
  });

  it("moves a battery size out of the model name", () => {
    const { records, skipped } = parseOpenEvData(
      {
        data: [
          oevd({ brand: "Kia", model: "EV9 76.1 kWh RWD" }),
          oevd({ id: "b", model: "39kwh" }),
        ],
      },
      "d",
    );
    expect(skipped).toEqual([{ ref: "open-ev-data:b", reason: 'trim used as model name "39kwh"' }]);
    expect(records.map((r) => [r.model, r.trim])).toEqual([["EV9", "76.1 kWh RWD"]]);
  });

  it("skips trims used as model names and lowercase copies of named records", () => {
    const { records, skipped } = parseOpenEvData(
      {
        data: [
          oevd({ id: "named", brand: "Volvo", model: "EX30", usable_battery_size: 49 }),
          oevd({ id: "trim", brand: "Volvo", model: "twin motor", usable_battery_size: 64 }),
          oevd({ id: "copy", brand: "Volvo", model: "ex30 single", usable_battery_size: 49 }),
          oevd({ id: "unique", brand: "BMW", model: "i3", usable_battery_size: 19 }),
        ],
      },
      "d",
    );
    expect(records.map((r) => r.model)).toEqual(["EX30", "i3"]);
    expect(skipped.map((s) => s.reason)).toEqual([
      'trim used as model name "twin motor"',
      "lowercase copy of a properly named record",
    ]);
  });

  it("rejects an unexpected file shape", () => {
    expect(() => parseOpenEvData({ cars: [] }, "d")).toThrow(/data/);
    expect(() => parseOpenEvData(null, "d")).toThrow(/data/);
  });
});

const EPA_CSV = [
  "id,make,baseModel,model,year,atvType,combE,range",
  "1,Kia,EV3,EV3 Long Range,2025,EV,28.9,300",
  "2,Kia,EV9,EV9 Long Range RWD,2025,EV,35,",
  "3,Kia,EV9,EV9 Long Range AWD,2025,EV,38,280",
  "4,Toyota,Camry,Camry,2025,Hybrid,,",
  "5,Nissan,Leaf,Leaf,2012,EV,34,73",
  "6,Tesla,Model 3,Model 3,2025,EV,,",
  ",Ghost,,Ghost,2025,EV,20,100",
].join("\n");

describe("EPA", () => {
  const { records, skipped } = parseEpaCsv(EPA_CSV);

  it("keeps recent EVs and converts to metric", () => {
    expect(records.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(records[0]).toMatchObject({ consumptionKwh100km: 17.96, rangeKm: 482.8 });
    expect(records[1]).toMatchObject({ rangeKm: null });
    expect(skipped.map((s) => s.reason)).toEqual([
      "no consumption or range",
      "missing id, make or base model",
    ]);
  });

  it("matches one record per make, model and year, skipping ambiguous ones", () => {
    const matches = matchEpa(
      [
        { id: "v1", brand: "KIA", model: "ev3", yearFrom: 2025 },
        { id: "v2", brand: "Kia", model: "EV9", yearFrom: 2025 },
        { id: "v3", brand: "Kia", model: "EV3", yearFrom: 2024 },
      ],
      records,
    );
    expect(matches).toEqual([
      {
        variantId: "v1",
        epa: records[0],
        fields: { consumption_kwh_100km: 17.96, range_km: 482.8, range_cycle: "EPA" },
      },
    ]);
  });

  it("omits the range cycle when EPA has no range", () => {
    const [match] = matchEpa(
      [{ id: "v", brand: "Kia", model: "EV9", yearFrom: 2025 }],
      records.filter((r) => r.id === "2"),
    );
    expect(match?.fields.range_cycle).toBeNull();
  });

  it("links each EPA source to its record", () => {
    const [ev3] = records;
    if (!ev3) throw new Error("fixture");
    expect(epaSource(ev3, "2026-11-04")).toMatchObject({
      source: "EPA fueleconomy.gov",
      confidence: 0.7,
      source_url: expect.stringContaining("baseModel=EV3"),
    });
  });
});

describe("matchOcmConnectors", () => {
  const types = [
    { ID: 1, Title: "Type 1 (J1772)" },
    { ID: 25, Title: "Type 2 (Socket Only)" },
    { ID: 32, Title: "CCS (Type 1)" },
    { ID: 33, Title: "CCS (Type 2)" },
    { ID: 2, Title: "CHAdeMO" },
    { ID: 1038, Title: "GB-T AC - GB/T 20234.2 (Socket)" },
    { ID: 1040, Title: "GB-T DC - GB/T 20234.3" },
    { ID: 27, Title: "Renamed connector" },
  ];

  it("maps codes whose id and title still match", () => {
    const { ids, missing } = matchOcmConnectors({ ConnectionTypes: types });
    expect(ids).toEqual({
      TYPE1: 1,
      TYPE2: 25,
      GBT_AC: 1038,
      CCS1: 32,
      CCS2: 33,
      CHADEMO: 2,
      GBT_DC: 1040,
    });
    expect(missing).toEqual(["NACS"]);
  });

  it("drops obsolete types and rejects an unexpected shape", () => {
    const { missing } = matchOcmConnectors({
      ConnectionTypes: [{ ID: 2, Title: "CHAdeMO", IsObsolete: true }],
    });
    expect(missing).toContain("CHADEMO");
    expect(() => matchOcmConnectors({})).toThrow(/ConnectionTypes/);
  });
});

describe("mergeVariant", () => {
  const oevdSource: FieldSource = { source: "Open EV Data", confidence: 0.8 };
  const manual: FieldSource = { source: "manual", confidence: 1 };

  it("updates changed fields and records their source", () => {
    const result = mergeVariant(
      { battery_usable_kwh: 50, dc_max_kw: 80 },
      {},
      { battery_usable_kwh: 52, dc_max_kw: 80, ac_onboard_kw: null },
      oevdSource,
    );
    expect(result.patch).toEqual({ battery_usable_kwh: 52 });
    expect(result.fieldSources).toEqual({ battery_usable_kwh: oevdSource });
  });

  it("never overwrites a manual field, including the cycle of a manual range", () => {
    const result = mergeVariant(
      { dc_max_kw: 90, range_km: 450, range_cycle: "NEDC" },
      { dc_max_kw: manual, range_km: manual },
      { dc_max_kw: 80, range_km: 400, range_cycle: "WLTP" },
      oevdSource,
    );
    expect(result.patch).toEqual({});
    expect(result.protectedFields).toEqual(["dc_max_kw", "range_km"]);
  });

  it("ignores key order in JSON values", () => {
    const result = mergeVariant(
      { charge_curve: [{ kw: 50, soc: 0 }] as never },
      {},
      { charge_curve: [{ soc: 0, kw: 50 }] },
      oevdSource,
    );
    expect(result.patch).toEqual({});
  });

  it("only fills empty fields when asked", () => {
    const result = mergeVariant(
      { range_km: null, consumption_kwh_100km: 15 },
      {},
      { range_km: 480, range_cycle: "EPA", consumption_kwh_100km: 18 },
      oevdSource,
      { onlyEmpty: true },
    );
    expect(result.patch).toEqual({ range_km: 480, range_cycle: "EPA" });
    expect(Object.keys(result.fieldSources)).toEqual(["range_km"]);
  });
});
