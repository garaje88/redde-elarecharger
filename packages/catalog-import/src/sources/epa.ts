// EPA fueleconomy.gov bulk data (public domain). US-market models: no battery size and no DC data,
// so it only cross-checks and completes range and consumption of variants we already have.
import { parseCsv } from "../csv";
import { normalize, positive, round } from "../text";
import type { FieldSource, ParseResult, SkippedRecord, VariantFields } from "../types";

export const EPA_CSV_URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv";

const KM_PER_MILE = 1.609344;

export interface EpaVehicle {
  id: string;
  make: string;
  baseModel: string;
  model: string;
  year: number;
  /** kWh/100 km, converted from kWh/100 mi. */
  consumptionKwh100km: number | null;
  rangeKm: number | null;
}

export function parseEpaCsv(text: string, minYear = 2015): ParseResult<EpaVehicle> {
  const records: EpaVehicle[] = [];
  const skipped: SkippedRecord[] = [];

  for (const row of parseCsv(text)) {
    if (row.atvType !== "EV") continue;
    const year = Number(row.year);
    if (!Number.isInteger(year) || year < minYear) continue;

    const ref = `epa:${row.id ?? ""}`;
    const combE = positive(row.combE);
    const range = positive(row.range);
    if (!row.id || !row.make || !row.baseModel) {
      skipped.push({ ref, reason: "missing id, make or base model" });
      continue;
    }
    if (combE === null && range === null) {
      skipped.push({ ref, reason: "no consumption or range" });
      continue;
    }

    records.push({
      id: row.id,
      make: row.make.trim(),
      baseModel: row.baseModel.trim(),
      model: (row.model ?? "").trim(),
      year,
      consumptionKwh100km: combE === null ? null : round(combE / KM_PER_MILE, 2),
      rangeKm: range === null ? null : round(range * KM_PER_MILE, 1),
    });
  }

  return { records, skipped };
}

export interface CatalogVariantKey {
  id: string;
  brand: string;
  model: string;
  yearFrom: number;
}

export interface EpaMatch {
  variantId: string;
  epa: EpaVehicle;
  fields: VariantFields;
}

/**
 * Pairs each catalog variant with the EPA record of the same make, model and year. Ambiguous
 * matches (several EPA trims for one variant) are skipped rather than guessed.
 */
export function matchEpa(variants: CatalogVariantKey[], epa: EpaVehicle[]): EpaMatch[] {
  const index = new Map<string, EpaVehicle[]>();
  for (const record of epa) {
    const key = `${normalize(record.make)}|${normalize(record.baseModel)}|${record.year}`;
    index.set(key, [...(index.get(key) ?? []), record]);
  }

  const matches: EpaMatch[] = [];
  for (const variant of variants) {
    const candidates = index.get(
      `${normalize(variant.brand)}|${normalize(variant.model)}|${variant.yearFrom}`,
    );
    if (candidates?.length !== 1) continue;
    const [record] = candidates as [EpaVehicle];
    matches.push({
      variantId: variant.id,
      epa: record,
      fields: {
        consumption_kwh_100km: record.consumptionKwh100km,
        range_km: record.rangeKm,
        range_cycle: record.rangeKm === null ? null : "EPA",
      },
    });
  }
  return matches;
}

export const epaSource = (record: EpaVehicle, retrievedAt: string): FieldSource => ({
  source: "EPA fueleconomy.gov",
  source_url: `https://www.fueleconomy.gov/feg/PowerSearch.do?action=noform&path=1&year1=${record.year}&year2=${record.year}&make=${encodeURIComponent(record.make)}&baseModel=${encodeURIComponent(record.baseModel)}&srchtyp=ymm`,
  retrieved_at: retrievedAt,
  confidence: 0.7,
});
