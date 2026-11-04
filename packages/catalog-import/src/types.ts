export type RangeCycle = "NEDC" | "WLTP" | "EPA" | "CLTC";

export type ConnectorCode =
  "TYPE1" | "TYPE2" | "GBT_AC" | "CCS1" | "CCS2" | "CHADEMO" | "GBT_DC" | "NACS";

/** Provenance of one field, stored in `field_sources`. `source: "manual"` is never overwritten. */
export interface FieldSource {
  source: string;
  source_url?: string;
  retrieved_at?: string;
  /** 0–1. */
  confidence: number;
}

export interface CurvePoint {
  soc: number;
  kw: number;
}

/** Technical fields an importer may set on `ev_variants`. */
export interface VariantFields {
  battery_gross_kwh?: number | null;
  battery_usable_kwh?: number | null;
  range_km?: number | null;
  range_cycle?: RangeCycle | null;
  consumption_kwh_100km?: number | null;
  ac_onboard_kw?: number | null;
  ac_phases?: 1 | 3 | null;
  dc_max_kw?: number | null;
  connector_ac?: ConnectorCode | null;
  connector_dc?: ConnectorCode | null;
  charge_curve?: CurvePoint[] | null;
}

export type VariantField = keyof VariantFields;

export interface ImportedVariant {
  /** "<source>:<external id>". */
  sourceRef: string;
  brand: string;
  model: string;
  trim: string;
  yearFrom: number;
  fields: VariantFields;
  source: FieldSource;
}

export interface SkippedRecord {
  ref: string;
  reason: string;
}

export interface ParseResult<T> {
  records: T[];
  skipped: SkippedRecord[];
}
