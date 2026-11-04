import type { FieldSource, VariantField, VariantFields } from "./types";

export type FieldSources = Partial<Record<string, FieldSource>>;

export interface MergeOptions {
  /** Only fill fields that are empty today (cross-checking sources such as EPA). */
  onlyEmpty?: boolean;
}

export interface MergeResult {
  /** Fields to write; empty when nothing changed. */
  patch: VariantFields;
  fieldSources: FieldSources;
  /** Fields left untouched because a person set them by hand. */
  protectedFields: VariantField[];
}

/** Stable JSON: Postgres jsonb reorders object keys, so compare with sorted keys. */
const stable = (value: unknown): string =>
  JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

const isManual = (source: FieldSource | undefined) => source?.source === "manual";

/**
 * Field-level merge of an import into an existing variant. A field whose source is "manual"
 * (set by an admin) is never overwritten, and an import never erases a value with null.
 */
export function mergeVariant(
  current: VariantFields,
  currentSources: FieldSources,
  incoming: VariantFields,
  source: FieldSource,
  { onlyEmpty = false }: MergeOptions = {},
): MergeResult {
  const patch: VariantFields = {};
  const fieldSources: FieldSources = { ...currentSources };
  const protectedFields: VariantField[] = [];

  // range_km and range_cycle travel together: a range is meaningless without its cycle.
  const linked: Partial<Record<VariantField, VariantField>> = { range_cycle: "range_km" };

  for (const field of Object.keys(incoming) as VariantField[]) {
    const owner = linked[field] ?? field;
    const value = incoming[field];
    if (value === null || value === undefined) continue;
    if (isManual(currentSources[owner])) {
      if (field === owner) protectedFields.push(field);
      continue;
    }
    if (onlyEmpty && current[owner] !== null && current[owner] !== undefined) continue;
    if (same(current[field], value)) continue;

    Object.assign(patch, { [field]: value });
    if (field === owner) fieldSources[field] = source;
  }

  return { patch, fieldSources, protectedFields };
}
