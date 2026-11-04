import { z } from "zod";

// Limits mirror the database CHECKs (supabase/migrations).

export const RANGE_CYCLES = ["NEDC", "WLTP", "EPA", "CLTC"] as const;
export const CONNECTOR_CODES = [
  "TYPE1",
  "TYPE2",
  "GBT_AC",
  "CCS1",
  "CCS2",
  "CHADEMO",
  "GBT_DC",
  "NACS",
] as const;

// No OpenAPI ids on enums used with .nullable(): zod-to-openapi would make the shared
// component itself nullable.
export const RangeCycleSchema = z.enum(RANGE_CYCLES);
export const ConnectorCodeSchema = z.enum(CONNECTOR_CODES);
export const CatalogStatusSchema = z
  .enum(["verified", "pending"])
  .meta({ id: "CatalogStatus", description: "pending = a contribution awaiting admin review." });
export const ChargerKindSchema = z.enum(["wallbox", "portable"]).meta({ id: "ChargerKind" });
export const PhasesSchema = z.union([z.literal(1), z.literal(3)]);

export const FieldSourceSchema = z
  .object({
    source: z.string().meta({ example: "Open EV Data" }),
    source_url: z.url().optional(),
    retrieved_at: z.string().optional().meta({ description: "ISO date the value was read." }),
    confidence: z.number().min(0).max(1),
  })
  .meta({ id: "FieldSource" });

export const FieldSourcesSchema = z.record(z.string(), FieldSourceSchema).meta({
  id: "FieldSources",
  description: "Provenance per field; missing fields have no source.",
});

export const ChargeCurvePointSchema = z
  .object({ soc: z.number().min(0).max(100), kw: z.number().positive() })
  .meta({ id: "ChargeCurvePoint" });

export const ConnectorSchema = z
  .object({
    code: ConnectorCodeSchema,
    name: z.string(),
    current: z.enum(["AC", "DC"]),
    max_kw_typical: z.number().nullable(),
    ocm_id: z
      .number()
      .int()
      .nullable()
      .meta({ description: "ConnectionType id in Open Charge Map." }),
    compatible_adapters: z.array(ConnectorCodeSchema),
  })
  .meta({ id: "Connector" });

export const BrandSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    country: z.string().nullable(),
    model_count: z.number().int(),
  })
  .meta({ id: "Brand" });

export const ModelSummarySchema = z
  .object({
    id: z.uuid(),
    brand_id: z.uuid(),
    brand_name: z.string(),
    name: z.string(),
    body_type: z.string().nullable(),
    year_from: z.number().int(),
    year_to: z.number().int(),
    variant_count: z.number().int(),
  })
  .meta({ id: "ModelSummary" });

/** Technical fields shared by catalog variants, vehicle overrides and AI extractions. */
const specFields = {
  battery_gross_kwh: z.number().positive().max(9999).nullable(),
  battery_usable_kwh: z.number().positive().max(9999).nullable(),
  chemistry: z.string().max(40).nullable(),
  range_km: z.number().positive().max(9999).nullable(),
  range_cycle: RangeCycleSchema.nullable(),
  consumption_kwh_100km: z.number().positive().max(999).nullable(),
  curb_weight_kg: z.number().positive().max(99999).nullable(),
  ac_onboard_kw: z.number().positive().max(999).nullable(),
  ac_phases: PhasesSchema.nullable(),
  dc_max_kw: z.number().positive().max(9999).nullable(),
  connector_ac: ConnectorCodeSchema.nullable(),
  connector_dc: ConnectorCodeSchema.nullable(),
};

export const VariantSummarySchema = z
  .object({
    id: z.uuid(),
    year_from: z.number().int(),
    year_to: z.number().int().nullable(),
    trim: z.string(),
    battery_usable_kwh: specFields.battery_usable_kwh,
    range_km: specFields.range_km,
    range_cycle: specFields.range_cycle,
    status: CatalogStatusSchema,
  })
  .meta({ id: "VariantSummary" });

export const VariantSchema = z
  .object({
    id: z.uuid(),
    brand: z.object({ id: z.uuid(), name: z.string() }),
    model: z.object({ id: z.uuid(), name: z.string(), body_type: z.string().nullable() }),
    year_from: z.number().int(),
    year_to: z.number().int().nullable(),
    trim: z.string(),
    ...specFields,
    charge_curve: z.array(ChargeCurvePointSchema).nullable(),
    field_sources: FieldSourcesSchema,
    status: CatalogStatusSchema,
  })
  .meta({ id: "Variant", description: "Technical sheet of one year and version." });

export const ChargerModelSchema = z
  .object({
    id: z.uuid(),
    brand: z.string(),
    model: z.string(),
    kind: ChargerKindSchema,
    rated_kw: z.number().positive(),
    phases: PhasesSchema,
    max_amperage_a: z.number().nullable(),
    adjustable_amperage: z.array(z.number()),
    input_voltage_min: z.number().nullable(),
    input_voltage_max: z.number().nullable(),
    connector: ConnectorCodeSchema.nullable(),
    tethered_cable: z.boolean(),
    field_sources: FieldSourcesSchema,
    status: CatalogStatusSchema,
  })
  .meta({ id: "ChargerModel" });

const listOf = <T extends z.ZodType>(item: T, id: string) =>
  z.object({ items: z.array(item) }).meta({ id });

export const BrandListSchema = listOf(BrandSchema, "BrandList");
export const ModelListSchema = listOf(ModelSummarySchema, "ModelList");
export const VariantListSchema = listOf(VariantSummarySchema, "VariantList");
export const ChargerModelListSchema = listOf(ChargerModelSchema, "ChargerModelList");
export const ConnectorListSchema = listOf(ConnectorSchema, "ConnectorList");

// Query parameters ------------------------------------------------------------------------

const searchText = z.string().trim().max(80).default("");
const limit = z.coerce.number().int().min(1).max(100).default(30);

export const BrandQuerySchema = z.object({ q: searchText, limit });
export const ModelQuerySchema = z.object({ q: searchText, brand: z.uuid().optional(), limit });
export const VariantQuerySchema = z.object({ model: z.uuid() });
export const ChargerQuerySchema = z.object({ q: searchText, limit });

// AI lookup of missing models -----------------------------------------------------------------

export const CatalogKindSchema = z.enum(["vehicle", "charger"]).meta({ id: "CatalogKind" });

export const LookupRequestSchema = z
  .object({
    kind: CatalogKindSchema,
    query: z.string().trim().min(2).max(200).meta({
      description: "Brand and model as the user writes them.",
      example: "Deepal S07 2025",
    }),
  })
  .meta({ id: "LookupRequest" });

/** A spec the user confirms; every number is re-checked by the database CHECKs. */
export const VehicleSubmissionSpecSchema = z
  .object({
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
    year_from: z.number().int().min(1990).max(2100),
    year_to: z.number().int().min(1990).max(2100).nullable().default(null),
    trim: z.string().trim().max(80).default(""),
    ...specFields,
  })
  .refine((s) => s.year_to === null || s.year_to >= s.year_from, {
    path: ["year_to"],
    message: "year_to must not be before year_from",
  })
  .refine(
    (s) =>
      s.battery_usable_kwh === null ||
      s.battery_gross_kwh === null ||
      s.battery_usable_kwh <= s.battery_gross_kwh,
    { path: ["battery_usable_kwh"], message: "Usable capacity cannot exceed gross capacity" },
  )
  .refine((s) => s.range_km === null || s.range_cycle !== null, {
    path: ["range_cycle"],
    message: "A range needs its test cycle",
  })
  .meta({ id: "VehicleSubmissionSpec" });

export const ChargerSubmissionSpecSchema = z
  .object({
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
    kind: ChargerKindSchema,
    rated_kw: z.number().positive().max(999),
    phases: PhasesSchema.default(1),
    max_amperage_a: z.number().min(1).max(500).nullable(),
    adjustable_amperage: z.array(z.number().min(1).max(500)).max(20).default([]),
    input_voltage_min: z.number().min(100).max(1000).nullable(),
    input_voltage_max: z.number().min(100).max(1000).nullable(),
    connector: ConnectorCodeSchema.nullable(),
    tethered_cable: z.boolean().default(true),
  })
  .refine(
    (s) =>
      s.input_voltage_min === null ||
      s.input_voltage_max === null ||
      s.input_voltage_max >= s.input_voltage_min,
    { path: ["input_voltage_max"], message: "Maximum voltage must not be below the minimum" },
  )
  .meta({ id: "ChargerSubmissionSpec" });

export const FieldConfidenceSchema = z
  .record(z.string(), z.number().min(0).max(1))
  .meta({ id: "FieldConfidence", description: "0–1 confidence per extracted field." });

export const LookupSourceSchema = z
  .object({ title: z.string(), url: z.url() })
  .meta({ id: "LookupSource" });

export const SubmissionSchema = z
  .object({
    id: z.uuid(),
    kind: CatalogKindSchema,
    query: z.string(),
    status: z.enum(["pending", "approved", "rejected"]),
    /** null while nobody has extracted a sheet (AI unavailable or nothing found). */
    extracted: z
      .object({
        spec: z.union([VehicleSubmissionSpecSchema, ChargerSubmissionSpecSchema]),
        confidence: FieldConfidenceSchema,
        field_urls: z
          .record(z.string(), z.url())
          .meta({ description: "Page each field was read from, when known." }),
      })
      .nullable(),
    sources: z.array(LookupSourceSchema),
    created_variant_id: z.uuid().nullable(),
    created_charger_model_id: z.uuid().nullable(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .meta({ id: "Submission" });

export const ConfirmVehicleSubmissionSchema = z
  .object({ kind: z.literal("vehicle"), spec: VehicleSubmissionSpecSchema })
  .meta({ id: "ConfirmVehicleSubmission" });
export const ConfirmChargerSubmissionSchema = z
  .object({ kind: z.literal("charger"), spec: ChargerSubmissionSpecSchema })
  .meta({ id: "ConfirmChargerSubmission" });
export const ConfirmSubmissionSchema = z
  .discriminatedUnion("kind", [ConfirmVehicleSubmissionSchema, ConfirmChargerSubmissionSchema])
  .meta({ id: "ConfirmSubmission" });

export const ConfirmSubmissionResponseSchema = z
  .object({
    variant_id: z.uuid().nullable(),
    charger_model_id: z.uuid().nullable(),
  })
  .meta({ id: "ConfirmSubmissionResponse" });

export type RangeCycle = z.infer<typeof RangeCycleSchema>;
export type ConnectorCode = z.infer<typeof ConnectorCodeSchema>;
export type FieldSource = z.infer<typeof FieldSourceSchema>;
export type Brand = z.infer<typeof BrandSchema>;
export type ModelSummary = z.infer<typeof ModelSummarySchema>;
export type VariantSummary = z.infer<typeof VariantSummarySchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type ChargerModel = z.infer<typeof ChargerModelSchema>;
export type Connector = z.infer<typeof ConnectorSchema>;
export type LookupRequest = z.infer<typeof LookupRequestSchema>;
export type VehicleSubmissionSpec = z.infer<typeof VehicleSubmissionSpecSchema>;
export type ChargerSubmissionSpec = z.infer<typeof ChargerSubmissionSpecSchema>;
export type Submission = z.infer<typeof SubmissionSchema>;
export type ConfirmSubmission = z.infer<typeof ConfirmSubmissionSchema>;
