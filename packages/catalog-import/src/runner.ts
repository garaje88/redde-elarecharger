// Writes parsed imports into Supabase with the service role. Server-side only (CLI, CI job).
import type { Database, Json, TablesInsert } from "@elacharger/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_ALIASES } from "./aliases";
import { type FieldSources, mergeVariant } from "./merge";
import { type EpaVehicle, epaSource, matchEpa } from "./sources/epa";
import { matchOcmConnectors } from "./sources/ocm";
import { slugify } from "./text";
import type { ConnectorCode, ImportedVariant, SkippedRecord, VariantFields } from "./types";

export type CatalogClient = SupabaseClient<Database>;

export interface SyncSummary {
  source: string;
  inserted: number;
  updated: number;
  skippedVerified: number;
  errors: SkippedRecord[];
}

const MAX_LOGGED_ERRORS = 200;

const VARIANT_COLUMNS =
  "id, source_ref, battery_gross_kwh, battery_usable_kwh, range_km, range_cycle, consumption_kwh_100km, ac_onboard_kw, ac_phases, dc_max_kw, connector_ac_id, connector_dc_id, charge_curve, field_sources";

type VariantRow = Pick<
  Database["public"]["Tables"]["ev_variants"]["Row"],
  | "id"
  | "source_ref"
  | "battery_gross_kwh"
  | "battery_usable_kwh"
  | "range_km"
  | "range_cycle"
  | "consumption_kwh_100km"
  | "ac_onboard_kw"
  | "ac_phases"
  | "dc_max_kw"
  | "connector_ac_id"
  | "connector_dc_id"
  | "charge_curve"
  | "field_sources"
>;

function check<T>(result: { data: T; error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data returned`);
  return result.data as NonNullable<T>;
}

/** For writes that return no rows. */
function ensure(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
}

const asJson = (value: unknown) => value as NonNullable<Json>;

async function startRun(client: CatalogClient, source: string): Promise<number> {
  const row = check(
    await client.from("catalog_sync_runs").insert({ source }).select("id").single(),
    "start sync run",
  );
  return row.id;
}

async function finishRun(client: CatalogClient, id: number, summary: SyncSummary) {
  ensure(
    await client
      .from("catalog_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        inserted: summary.inserted,
        updated: summary.updated,
        skipped_verified: summary.skippedVerified,
        errors: asJson(summary.errors.slice(0, MAX_LOGGED_ERRORS)),
      })
      .eq("id", id),
    "finish sync run",
  );
}

async function connectorIds(client: CatalogClient): Promise<Map<string, number>> {
  const rows = check(await client.from("connector_types").select("id, code"), "load connectors");
  return new Map(rows.map((row) => [row.code, row.id]));
}

/** Converts importer fields into `ev_variants` columns. */
function toColumns(fields: VariantFields, connectors: Map<string, number>) {
  const { connector_ac, connector_dc, charge_curve, ...rest } = fields;
  const columns: Partial<TablesInsert<"ev_variants">> = { ...rest };
  if (connector_ac !== undefined)
    columns.connector_ac_id = connector_ac ? (connectors.get(connector_ac) ?? null) : null;
  if (connector_dc !== undefined)
    columns.connector_dc_id = connector_dc ? (connectors.get(connector_dc) ?? null) : null;
  if (charge_curve !== undefined) columns.charge_curve = charge_curve as unknown as Json;
  return columns;
}

/** Converts a row back into importer fields, so merges compare like with like. */
function toFields(row: VariantRow, codes: Map<number, string>): VariantFields {
  const code = (id: number | null) =>
    id === null ? null : ((codes.get(id) ?? null) as ConnectorCode | null);
  return {
    battery_gross_kwh: row.battery_gross_kwh,
    battery_usable_kwh: row.battery_usable_kwh,
    range_km: row.range_km,
    range_cycle: row.range_cycle,
    consumption_kwh_100km: row.consumption_kwh_100km,
    ac_onboard_kw: row.ac_onboard_kw,
    ac_phases: row.ac_phases === 1 || row.ac_phases === 3 ? row.ac_phases : null,
    dc_max_kw: row.dc_max_kw,
    connector_ac: code(row.connector_ac_id),
    connector_dc: code(row.connector_dc_id),
    charge_curve: row.charge_curve as VariantFields["charge_curve"],
  };
}

async function ensureBrandsAndModels(client: CatalogClient, records: ImportedVariant[]) {
  const brands = new Map(
    check(await client.from("ev_brands").select("id, slug"), "load brands").map((b) => [
      b.slug,
      b.id,
    ]),
  );
  const newBrands = new Map<string, string>();
  for (const record of records) {
    const slug = slugify(record.brand);
    if (!brands.has(slug) && !newBrands.has(slug)) newBrands.set(slug, record.brand);
  }
  if (newBrands.size > 0) {
    const inserted = check(
      await client
        .from("ev_brands")
        .insert([...newBrands].map(([slug, name]) => ({ slug, name })))
        .select("id, slug"),
      "insert brands",
    );
    for (const brand of inserted) brands.set(brand.slug, brand.id);
  }

  const models = new Map(
    check(await client.from("ev_models").select("id, brand_id, slug"), "load models").map((m) => [
      `${m.brand_id}|${m.slug}`,
      m.id,
    ]),
  );
  const newModels = new Map<string, { brand_id: string; slug: string; name: string }>();
  for (const record of records) {
    const brandId = brands.get(slugify(record.brand)) as string;
    const key = `${brandId}|${slugify(record.model)}`;
    if (!models.has(key) && !newModels.has(key))
      newModels.set(key, { brand_id: brandId, slug: slugify(record.model), name: record.model });
  }
  if (newModels.size > 0) {
    const inserted = check(
      await client
        .from("ev_models")
        .insert([...newModels.values()])
        .select("id, brand_id, slug"),
      "insert models",
    );
    for (const model of inserted) models.set(`${model.brand_id}|${model.slug}`, model.id);
  }

  for (const [key, aliases] of Object.entries(MODEL_ALIASES)) {
    const [brandSlug, modelSlug] = key.split("|");
    const id = models.get(`${brands.get(brandSlug ?? "")}|${modelSlug}`);
    if (id)
      ensure(await client.from("ev_models").update({ aliases }).eq("id", id), `aliases ${key}`);
  }

  return (record: ImportedVariant) =>
    models.get(`${brands.get(slugify(record.brand))}|${slugify(record.model)}`) as string;
}

/** Inserts new variants and merges existing ones (matched by `source_ref`). */
export async function importVariants(
  client: CatalogClient,
  source: string,
  records: ImportedVariant[],
  skipped: SkippedRecord[],
): Promise<SyncSummary> {
  const runId = await startRun(client, source);
  const summary: SyncSummary = {
    source,
    inserted: 0,
    updated: 0,
    skippedVerified: 0,
    errors: [...skipped],
  };

  try {
    const connectors = await connectorIds(client);
    const codes = new Map([...connectors].map(([code, id]) => [id, code]));
    const modelId = await ensureBrandsAndModels(client, records);
    const existing = new Map(
      check(
        await client.from("ev_variants").select(VARIANT_COLUMNS).like("source_ref", `${source}:%`),
        "load variants",
      ).map((row) => [row.source_ref as string, row]),
    );

    const inserts: TablesInsert<"ev_variants">[] = [];
    for (const record of records) {
      const row = existing.get(record.sourceRef);
      if (!row) {
        const fieldSources = Object.fromEntries(
          Object.entries(record.fields)
            .filter(([field, value]) => value !== null && field !== "range_cycle")
            .map(([field]) => [field, record.source]),
        );
        inserts.push({
          ...toColumns(record.fields, connectors),
          model_id: modelId(record),
          year_from: record.yearFrom,
          trim: record.trim,
          source_ref: record.sourceRef,
          status: "verified",
          field_sources: asJson(fieldSources),
        });
        continue;
      }

      const merged = mergeVariant(
        toFields(row, codes),
        row.field_sources as FieldSources,
        record.fields,
        record.source,
      );
      summary.skippedVerified += merged.protectedFields.length;
      if (Object.keys(merged.patch).length === 0) continue;
      ensure(
        await client
          .from("ev_variants")
          .update({
            ...toColumns(merged.patch, connectors),
            field_sources: asJson(merged.fieldSources),
          })
          .eq("id", row.id),
        `update ${record.sourceRef}`,
      );
      summary.updated++;
    }

    for (let i = 0; i < inserts.length; i += 200) {
      const batch = inserts.slice(i, i + 200);
      const result = await client.from("ev_variants").insert(batch);
      if (result.error) {
        // Retry one by one so a single bad record does not lose the batch.
        for (const insert of batch) {
          const single = await client.from("ev_variants").insert(insert);
          if (single.error)
            summary.errors.push({ ref: insert.source_ref ?? "?", reason: single.error.message });
          else summary.inserted++;
        }
      } else {
        summary.inserted += batch.length;
      }
    }
  } catch (error) {
    summary.errors.push({
      ref: source,
      reason: error instanceof Error ? error.message : String(error),
    });
    await finishRun(client, runId, summary);
    throw error;
  }

  await finishRun(client, runId, summary);
  return summary;
}

/** Fills range and consumption from EPA where the catalog has none, never overwriting data. */
export async function importEpa(
  client: CatalogClient,
  epa: EpaVehicle[],
  skipped: SkippedRecord[],
  retrievedAt: string,
): Promise<SyncSummary> {
  const source = "epa";
  const runId = await startRun(client, source);
  const summary: SyncSummary = {
    source,
    inserted: 0,
    updated: 0,
    skippedVerified: 0,
    errors: [...skipped],
  };

  try {
    const connectors = await connectorIds(client);
    const codes = new Map([...connectors].map(([code, id]) => [id, code]));
    const rows = check(
      await client
        .from("ev_variants")
        .select(`${VARIANT_COLUMNS}, year_from, ev_models!inner(name, ev_brands!inner(name))`)
        .eq("status", "verified"),
      "load variants",
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    const matches = matchEpa(
      rows.map((row) => ({
        id: row.id,
        brand: row.ev_models.ev_brands.name,
        model: row.ev_models.name,
        yearFrom: row.year_from,
      })),
      epa,
    );

    for (const match of matches) {
      const row = byId.get(match.variantId) as (typeof rows)[number];
      const merged = mergeVariant(
        toFields(row, codes),
        row.field_sources as FieldSources,
        match.fields,
        epaSource(match.epa, retrievedAt),
        { onlyEmpty: true },
      );
      summary.skippedVerified += merged.protectedFields.length;
      if (Object.keys(merged.patch).length === 0) continue;
      ensure(
        await client
          .from("ev_variants")
          .update({
            ...toColumns(merged.patch, connectors),
            field_sources: asJson(merged.fieldSources),
          })
          .eq("id", row.id),
        `update ${row.id}`,
      );
      summary.updated++;
    }
  } catch (error) {
    summary.errors.push({
      ref: source,
      reason: error instanceof Error ? error.message : String(error),
    });
    await finishRun(client, runId, summary);
    throw error;
  }

  await finishRun(client, runId, summary);
  return summary;
}

/** Records the Open Charge Map id of each reference connector. */
export async function importOcm(
  client: CatalogClient,
  referenceData: unknown,
): Promise<SyncSummary> {
  const source = "open-charge-map";
  const runId = await startRun(client, source);
  const summary: SyncSummary = { source, inserted: 0, updated: 0, skippedVerified: 0, errors: [] };

  const { ids, missing } = matchOcmConnectors(referenceData);
  summary.errors.push(
    ...missing.map((code) => ({ ref: code, reason: "no matching OCM connection type" })),
  );
  const rows = check(
    await client.from("connector_types").select("id, code, ocm_id"),
    "load connectors",
  );
  for (const row of rows) {
    const ocmId = ids[row.code as ConnectorCode];
    if (ocmId === undefined || ocmId === row.ocm_id) continue;
    ensure(
      await client.from("connector_types").update({ ocm_id: ocmId }).eq("id", row.id),
      `update ${row.code}`,
    );
    summary.updated++;
  }

  await finishRun(client, runId, summary);
  return summary;
}
