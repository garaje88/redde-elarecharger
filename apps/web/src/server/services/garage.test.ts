import type { ChargerModel, Submission, Variant } from "@elacharger/schemas";
import { describe, expect, it } from "vitest";
import { chargerPower } from "./chargers";
import { fieldSourcesFor } from "./lookup";
import { completeOverrides, resolveSpec } from "@/features/garage/resolve-spec";

const variant = {
  id: "0b8f6a4e-0000-4000-8000-000000000003",
  brand: { id: "0b8f6a4e-0000-4000-8000-000000000001", name: "Deepal" },
  model: { id: "0b8f6a4e-0000-4000-8000-000000000002", name: "S05", body_type: "suv" },
  year_from: 2026,
  year_to: null,
  trim: "E-Max",
  battery_gross_kwh: 56.12,
  battery_usable_kwh: 56.12,
  chemistry: "LFP",
  range_km: 458,
  range_cycle: "NEDC",
  consumption_kwh_100km: null,
  curb_weight_kg: null,
  ac_onboard_kw: null,
  ac_phases: null,
  dc_max_kw: null,
  connector_ac: null,
  connector_dc: null,
  charge_curve: null,
  field_sources: {},
  status: "verified",
} satisfies Variant;

describe("resolveSpec", () => {
  it("applies the user's corrections over the catalog", () => {
    const spec = resolveSpec(variant, { ac_onboard_kw: 6.6, range_km: 420, range_cycle: "WLTP" });
    expect(spec).toMatchObject({
      battery_usable_kwh: 56.12,
      ac_onboard_kw: 6.6,
      range_km: 420,
      range_cycle: "WLTP",
    });
  });

  it("starts from an empty sheet when the variant is no longer visible", () => {
    expect(resolveSpec(null, { battery_usable_kwh: 40 })).toMatchObject({
      battery_usable_kwh: 40,
      range_km: null,
    });
  });
});

describe("completeOverrides", () => {
  it("adds the catalog cycle to a corrected range", () => {
    const base = resolveSpec(variant, {});
    expect(completeOverrides(base, { range_km: 420 })).toEqual({
      range_km: 420,
      range_cycle: "NEDC",
    });
    expect(completeOverrides(base, { dc_max_kw: 50 })).toEqual({ dc_max_kw: 50 });
  });
});

describe("chargerPower", () => {
  const wallbox = { rated_kw: 7.4, max_amperage_a: 32 } as ChargerModel;

  it("is limited by the circuit or the charger", () => {
    expect(chargerPower({ voltage_v: 220, phases: 1, circuit_amperage_a: 32 }, wallbox)).toEqual({
      kw: 7.04,
      limited_by: "circuit",
      warnings: [],
    });
    expect(chargerPower({ voltage_v: 240, phases: 1, circuit_amperage_a: 40 }, wallbox)).toEqual({
      kw: 7.4,
      limited_by: "charger",
      warnings: ["amperage_above_charger_max"],
    });
  });

  it("warns about a 110 V circuit above 16 A without a charger model", () => {
    expect(
      chargerPower({ voltage_v: 110, phases: 1, circuit_amperage_a: 20 }, null).warnings,
    ).toEqual(["low_voltage_high_amperage"]);
  });
});

describe("fieldSourcesFor", () => {
  const submission = {
    extracted: {
      spec: { battery_usable_kwh: 66.8, range_km: 485, range_cycle: "NEDC" },
      confidence: { battery_usable_kwh: 0.9, range_km: 0.7 },
      field_urls: { battery_usable_kwh: "https://deepal.com.co/s07" },
    },
  } as unknown as Submission;

  it("credits the AI for unchanged values and the user for edits", () => {
    const sources = fieldSourcesFor(
      submission,
      {
        brand: "Deepal",
        battery_usable_kwh: 66.8,
        range_km: 500,
        range_cycle: "NEDC",
        dc_max_kw: null,
      },
      "2026-11-04",
    );
    expect(sources).toEqual({
      battery_usable_kwh: {
        source: "Búsqueda web con IA",
        source_url: "https://deepal.com.co/s07",
        retrieved_at: "2026-11-04",
        confidence: 0.9,
      },
      range_km: { source: "usuario", retrieved_at: "2026-11-04", confidence: 1 },
      range_cycle: { source: "Búsqueda web con IA", retrieved_at: "2026-11-04", confidence: 0.5 },
    });
  });

  it("credits the user for everything when nothing was extracted", () => {
    const sources = fieldSourcesFor(
      { extracted: null } as Submission,
      { battery_usable_kwh: 50 },
      "d",
    );
    expect(sources.battery_usable_kwh?.source).toBe("usuario");
  });
});
