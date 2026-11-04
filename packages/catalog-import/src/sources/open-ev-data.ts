// Open EV Data (MIT with attribution): https://github.com/KilowattApp/open-ev-data
// Archived since 2025, so it is a one-time initial import that later runs simply re-confirm.
import { clean, positive, round } from "../text";
import type {
  ConnectorCode,
  CurvePoint,
  FieldSource,
  ImportedVariant,
  ParseResult,
  SkippedRecord,
} from "../types";

export const OPEN_EV_DATA_URL =
  "https://raw.githubusercontent.com/KilowattApp/open-ev-data/master/data/ev-data.json";
export const OPEN_EV_DATA_REPO = "https://github.com/KilowattApp/open-ev-data";

interface RawCharger {
  ports?: unknown;
  usable_phases?: unknown;
  max_power?: unknown;
  charging_curve?: unknown;
  is_default_charging_curve?: unknown;
}

interface RawRecord {
  id?: unknown;
  brand?: unknown;
  model?: unknown;
  variant?: unknown;
  release_year?: unknown;
  vehicle_type?: unknown;
  usable_battery_size?: unknown;
  battery_size?: unknown;
  ac_charger?: RawCharger | null;
  dc_charger?: RawCharger | null;
  energy_consumption?: { average_consumption?: unknown; range?: unknown } | null;
}

const ports = (charger: RawCharger | null | undefined): string[] =>
  Array.isArray(charger?.ports) ? charger.ports.filter((p) => typeof p === "string") : [];

function acConnector(record: RawRecord): ConnectorCode | null {
  const ac = ports(record.ac_charger);
  if (ac.includes("type2")) return "TYPE2";
  if (ac.includes("type1")) return "TYPE1";
  return null;
}

function dcConnector(record: RawRecord, ac: ConnectorCode | null): ConnectorCode | null {
  const dc = ports(record.dc_charger);
  // "ccs" follows the AC inlet: CCS2 cars have Type 2, CCS1 cars have Type 1.
  if (dc.includes("ccs") || dc.includes("tesla_ccs")) return ac === "TYPE1" ? "CCS1" : "CCS2";
  if (dc.includes("tesla_suc")) return "NACS";
  if (dc.includes("chademo")) return "CHADEMO";
  return null;
}

/** Only measured curves: the dataset's default curves are generic and add nothing to ours. */
function chargeCurve(charger: RawCharger | null | undefined): CurvePoint[] | null {
  if (!charger || charger.is_default_charging_curve !== false) return null;
  if (!Array.isArray(charger.charging_curve)) return null;
  const points = charger.charging_curve
    .map((point: { percentage?: unknown; power?: unknown }) => ({
      soc: typeof point.percentage === "number" ? point.percentage : NaN,
      kw: positive(point.power),
    }))
    .filter((p): p is CurvePoint => p.soc >= 0 && p.soc <= 100 && p.kw !== null)
    .map((p) => ({ soc: p.soc, kw: round(p.kw, 1) }));
  return points.length >= 2 ? points : null;
}

// Many records carry a trim in the model field ("long range", "twin motor", "edrive40").
const TRIM_TOKEN =
  /^(standard|long|extra|range|dual|single|twin|motor|gt|awd|rwd|2wd|4wd|electric|plus|turbo|s|n|r|m|l|x|e|performance|tourer|combi|life|shuttle|verso|flagship|advance|cabrio|hatchback|ev|suv|sport|sportback|pro|max|premium|privilege|quattro|4matic|[ex]drive\d*|[mr]\d+|\d+[+]?|\d+(\.\d+)?kwh)$/;

const isTrimOnly = (model: string) =>
  model === model.toLowerCase() && model.split(/[\s-]+/).every((token) => TRIM_TOKEN.test(token));

/** "EV9 76.1 kWh RWD" → model "EV9", trim "76.1 kWh RWD": keeps one model per car. */
function splitBatteryFromModel(model: string, trim: string): { model: string; trim: string } {
  const match = /^(.*?[a-z].*?)\s+(\d+(?:[.,]\d+)?\s?kwh\b.*)$/i.exec(model);
  if (!match?.[1] || !match[2]) return { model, trim };
  return { model: match[1].trim(), trim: match[2].trim() };
}

const phases = (value: unknown): 1 | 3 | null => (value === 1 || value === 3 ? value : null);

export function parseOpenEvData(json: unknown, retrievedAt: string): ParseResult<ImportedVariant> {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error("Open EV Data: expected a top-level `data` array.");

  const source: FieldSource = {
    source: "Open EV Data",
    source_url: OPEN_EV_DATA_REPO,
    retrieved_at: retrievedAt,
    confidence: 0.8,
  };
  const records: ImportedVariant[] = [];
  const skipped: SkippedRecord[] = [];
  const seen = new Set<string>();
  const rows = data as RawRecord[];

  // Lowercase model names are mostly garbled copies of a properly named record of the same car.
  const properlyNamed = new Set(
    rows
      .filter((raw) => /[A-Z]/.test(clean(raw.model)))
      .map((raw) => `${clean(raw.brand)}|${String(raw.usable_battery_size)}`),
  );

  for (const raw of rows) {
    const id = clean(raw.id);
    const ref = `open-ev-data:${id}`;
    const brand = clean(raw.brand);
    const { model, trim } = splitBatteryFromModel(clean(raw.model), clean(raw.variant));
    const lowercase = model === model.toLowerCase();
    const year = raw.release_year;
    const usable = positive(raw.usable_battery_size);

    const reason = !id
      ? "missing id"
      : raw.vehicle_type !== "car"
        ? `vehicle type ${String(raw.vehicle_type)}`
        : !brand
          ? "missing brand"
          : !/[a-z]/i.test(model)
            ? `malformed model name "${model}"`
            : lowercase && isTrimOnly(model)
              ? `trim used as model name "${model}"`
              : lowercase && properlyNamed.has(`${brand}|${String(raw.usable_battery_size)}`)
                ? "lowercase copy of a properly named record"
                : typeof year !== "number" || year < 1990 || year > 2100
                  ? "missing release year"
                  : usable === null
                    ? "missing usable battery"
                    : null;
    if (reason) {
      skipped.push({ ref, reason });
      continue;
    }

    const key = [brand, model, trim, year, usable].join("|").toLowerCase();
    if (seen.has(key)) {
      skipped.push({ ref, reason: "duplicate of another record" });
      continue;
    }
    seen.add(key);

    const gross = positive(raw.battery_size);
    const range = positive(raw.energy_consumption?.range);
    const connectorAc = acConnector(raw);

    records.push({
      sourceRef: ref,
      brand,
      model,
      trim,
      yearFrom: year as number,
      source,
      fields: {
        battery_usable_kwh: usable,
        battery_gross_kwh: gross !== null && usable !== null && gross >= usable ? gross : null,
        consumption_kwh_100km: positive(raw.energy_consumption?.average_consumption),
        range_km: range,
        range_cycle: range === null ? null : "WLTP",
        ac_onboard_kw: positive(raw.ac_charger?.max_power),
        ac_phases: phases(raw.ac_charger?.usable_phases),
        dc_max_kw: positive(raw.dc_charger?.max_power),
        connector_ac: connectorAc,
        connector_dc: dcConnector(raw, connectorAc),
        charge_curve: chargeCurve(raw.dc_charger),
      },
    });
  }

  return { records, skipped };
}
