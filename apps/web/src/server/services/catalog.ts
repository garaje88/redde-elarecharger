import "server-only";
import type {
  Brand,
  ChargerModel,
  Connector,
  ConnectorCode,
  ModelSummary,
  Variant,
  VariantSummary,
} from "@elacharger/schemas";
import { type Db, unwrap } from "../db";

// Every query runs as the caller, so RLS decides which pending contributions are visible.

type FieldSources = Variant["field_sources"];
type ChargeCurve = Variant["charge_curve"];

export const VARIANT_SELECT = `
  id, year_from, year_to, trim, battery_gross_kwh, battery_usable_kwh, chemistry, range_km,
  range_cycle, consumption_kwh_100km, curb_weight_kg, ac_onboard_kw, ac_phases, dc_max_kw,
  charge_curve, field_sources, status,
  connector_ac:connector_types!ev_variants_connector_ac_id_fkey(code),
  connector_dc:connector_types!ev_variants_connector_dc_id_fkey(code),
  model:ev_models!inner(id, name, body_type, brand:ev_brands!inner(id, name))
` as const;

export const CHARGER_MODEL_SELECT = `
  id, brand, model, kind, rated_kw, phases, max_amperage_a, adjustable_amperage,
  input_voltage_min, input_voltage_max, tethered_cable, field_sources, status,
  connector:connector_types(code)
` as const;

const phases = (value: number | null) => (value === 1 || value === 3 ? value : null);
const code = (row: { code: string } | null) => (row?.code ?? null) as ConnectorCode | null;

interface VariantRow {
  id: string;
  year_from: number;
  year_to: number | null;
  trim: string;
  battery_gross_kwh: number | null;
  battery_usable_kwh: number | null;
  chemistry: string | null;
  range_km: number | null;
  range_cycle: Variant["range_cycle"];
  consumption_kwh_100km: number | null;
  curb_weight_kg: number | null;
  ac_onboard_kw: number | null;
  ac_phases: number | null;
  dc_max_kw: number | null;
  charge_curve: unknown;
  field_sources: unknown;
  status: Variant["status"];
  connector_ac: { code: string } | null;
  connector_dc: { code: string } | null;
  model: {
    id: string;
    name: string;
    body_type: string | null;
    brand: { id: string; name: string };
  };
}

export function toVariant(row: VariantRow): Variant {
  return {
    id: row.id,
    brand: { id: row.model.brand.id, name: row.model.brand.name },
    model: { id: row.model.id, name: row.model.name, body_type: row.model.body_type },
    year_from: row.year_from,
    year_to: row.year_to,
    trim: row.trim,
    battery_gross_kwh: row.battery_gross_kwh,
    battery_usable_kwh: row.battery_usable_kwh,
    chemistry: row.chemistry,
    range_km: row.range_km,
    range_cycle: row.range_cycle,
    consumption_kwh_100km: row.consumption_kwh_100km,
    curb_weight_kg: row.curb_weight_kg,
    ac_onboard_kw: row.ac_onboard_kw,
    ac_phases: phases(row.ac_phases),
    dc_max_kw: row.dc_max_kw,
    connector_ac: code(row.connector_ac),
    connector_dc: code(row.connector_dc),
    charge_curve: (row.charge_curve ?? null) as ChargeCurve,
    field_sources: (row.field_sources ?? {}) as FieldSources,
    status: row.status,
  };
}

interface ChargerModelRow {
  id: string;
  brand: string;
  model: string;
  kind: ChargerModel["kind"];
  rated_kw: number;
  phases: number;
  max_amperage_a: number | null;
  adjustable_amperage: number[];
  input_voltage_min: number | null;
  input_voltage_max: number | null;
  tethered_cable: boolean;
  field_sources: unknown;
  status: ChargerModel["status"];
  connector: { code: string } | null;
}

export function toChargerModel(row: ChargerModelRow): ChargerModel {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    kind: row.kind,
    rated_kw: row.rated_kw,
    phases: phases(row.phases) ?? 1,
    max_amperage_a: row.max_amperage_a,
    adjustable_amperage: row.adjustable_amperage,
    input_voltage_min: row.input_voltage_min,
    input_voltage_max: row.input_voltage_max,
    connector: code(row.connector),
    tethered_cable: row.tethered_cable,
    field_sources: (row.field_sources ?? {}) as ChargerModel["field_sources"],
    status: row.status,
  };
}

export async function searchBrands(db: Db, q: string, limit: number): Promise<Brand[]> {
  const rows = unwrap(
    await db.rpc("search_ev_brands", { query: q, max_rows: limit }),
    "Brand search",
  );
  return rows.map((row) => ({
    ...row,
    country: row.country ?? null,
    model_count: Number(row.model_count),
  }));
}

export async function searchModels(
  db: Db,
  q: string,
  brand: string | undefined,
  limit: number,
): Promise<ModelSummary[]> {
  const rows = unwrap(
    await db.rpc("search_ev_models", { query: q, max_rows: limit, ...(brand ? { brand } : {}) }),
    "Model search",
  );
  return rows.map((row) => ({
    id: row.id,
    brand_id: row.brand_id,
    brand_name: row.brand_name,
    name: row.name,
    body_type: row.body_type ?? null,
    year_from: row.year_from,
    year_to: row.year_to,
    variant_count: Number(row.variant_count),
  }));
}

export async function listVariants(db: Db, modelId: string): Promise<VariantSummary[]> {
  const rows = unwrap(
    await db
      .from("ev_variants")
      .select("id, year_from, year_to, trim, battery_usable_kwh, range_km, range_cycle, status")
      .eq("model_id", modelId)
      .order("year_from", { ascending: false })
      .order("battery_usable_kwh", { ascending: true, nullsFirst: false })
      .order("trim"),
    "Variants",
  );
  return rows;
}

export async function getVariant(db: Db, id: string): Promise<Variant> {
  const row = unwrap(
    await db.from("ev_variants").select(VARIANT_SELECT).eq("id", id).maybeSingle(),
    "Variant",
  );
  return toVariant(row as VariantRow);
}

export async function searchChargerModels(
  db: Db,
  q: string,
  limit: number,
): Promise<ChargerModel[]> {
  const ids = unwrap(
    await db.rpc("search_charger_models", { query: q, max_rows: limit }).select("id"),
    "Charger search",
  ).map((row) => row.id);
  if (ids.length === 0) return [];

  const rows = unwrap(
    await db.from("charger_models").select(CHARGER_MODEL_SELECT).in("id", ids),
    "Chargers",
  ) as ChargerModelRow[];
  // Keep the ranking of the search function.
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toChargerModel(row)] : [];
  });
}

export async function getChargerModel(db: Db, id: string): Promise<ChargerModel> {
  const row = unwrap(
    await db.from("charger_models").select(CHARGER_MODEL_SELECT).eq("id", id).maybeSingle(),
    "Charger model",
  );
  return toChargerModel(row as ChargerModelRow);
}

export async function listConnectors(db: Db): Promise<Connector[]> {
  const rows = unwrap(
    await db
      .from("connector_types")
      .select("code, name, current, max_kw_typical, ocm_id, compatible_adapters")
      .order("current")
      .order("code"),
    "Connectors",
  );
  return rows.map((row) => ({
    ...row,
    code: row.code as ConnectorCode,
    compatible_adapters: row.compatible_adapters as ConnectorCode[],
  }));
}

/** Connector id for a code, or null; throws 422 for an unknown code. */
export async function connectorId(db: Db, value: ConnectorCode | null): Promise<number | null> {
  if (value === null) return null;
  const row = unwrap(
    await db.from("connector_types").select("id").eq("code", value).maybeSingle(),
    "Connector",
  );
  return row.id;
}
